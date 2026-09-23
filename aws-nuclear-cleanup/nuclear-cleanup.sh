#!/bin/bash
#===============================================================================
# AWS Nuclear Cleanup Script (Standalone)
#
# Removes all AWS resources for a given project prefix. Works with any project
# that follows the naming convention: {project-name}-{resource}.
#
# Usage:
#   ./nuclear-cleanup.sh --project my-app                          # Sweeps us-east-1 & us-east-2
#   ./nuclear-cleanup.sh --project my-app --region us-east-2       # Single region
#   ./nuclear-cleanup.sh --project my-app --dry-run                # Preview mode
#   ./nuclear-cleanup.sh --project my-app --force                  # Skip confirmations
#
# Optional overrides (auto-derived from --project if not provided):
#   --s3-bucket NAME          S3 bucket name (default: {project}-frontend-{account-id})
#   --dynamodb-table NAME     DynamoDB table name (default: {project}-data)
#   --cognito-pool NAME       Cognito User Pool name (default: {project}-user-pool)
#   --iam-role NAME           Lambda execution role name (default: {project}-lambda-execution-role)
#   --config-dir PATH         Generated config directory to remove
#
# Requirements: aws cli, jq
#===============================================================================

set -e

#-------------------------------------------------------------------------------
# Default values
#-------------------------------------------------------------------------------
PROJECT_NAME=""
AWS_REGION=""
S3_BUCKET_NAME=""
DYNAMODB_TABLE_NAME=""
COGNITO_USER_POOL_NAME=""
IAM_ROLE_NAME=""
CONFIG_DIR=""
FORCE=false
DRY_RUN=false

DEFAULT_REGIONS=("us-east-1" "us-east-2")

#-------------------------------------------------------------------------------
# Parse Arguments
#-------------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
    case $1 in
        --project|-p)
            PROJECT_NAME="$2"
            shift 2
            ;;
        --region|-r)
            AWS_REGION="$2"
            shift 2
            ;;
        --s3-bucket)
            S3_BUCKET_NAME="$2"
            shift 2
            ;;
        --dynamodb-table)
            DYNAMODB_TABLE_NAME="$2"
            shift 2
            ;;
        --cognito-pool)
            COGNITO_USER_POOL_NAME="$2"
            shift 2
            ;;
        --iam-role)
            IAM_ROLE_NAME="$2"
            shift 2
            ;;
        --config-dir)
            CONFIG_DIR="$2"
            shift 2
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 --project NAME [--region REGION] [options]"
            echo ""
            echo "Required:"
            echo "  --project, -p NAME       Project name prefix (e.g., my-app)"
            echo ""
            echo "Optional:"
            echo "  --region, -r REGION      AWS region (default: sweeps us-east-1 & us-east-2)"
            echo ""
            echo "Optional overrides:"
            echo "  --s3-bucket NAME         S3 bucket name (default: {project}-frontend-{account-id})"
            echo "  --dynamodb-table NAME    DynamoDB table name (default: {project}-data)"
            echo "  --cognito-pool NAME      Cognito User Pool name (default: {project}-user-pool)"
            echo "  --iam-role NAME          Lambda execution role name (default: {project}-lambda-execution-role)"
            echo "  --config-dir PATH        Generated config directory to remove"
            echo ""
            echo "Flags:"
            echo "  --force                  Skip all confirmation prompts (VERY DANGEROUS!)"
            echo "  --dry-run                Show what would be deleted without executing"
            echo "  --help, -h               Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Run '$0 --help' for usage."
            exit 1
            ;;
    esac
done

#-------------------------------------------------------------------------------
# Validate required args
#-------------------------------------------------------------------------------
if [ -z "$PROJECT_NAME" ]; then
    echo "Error: --project is required"
    echo "Run '$0 --help' for usage."
    exit 1
fi

#-------------------------------------------------------------------------------
# Determine regions to sweep
#-------------------------------------------------------------------------------
if [ -n "$AWS_REGION" ]; then
    REGIONS=("$AWS_REGION")
else
    REGIONS=("${DEFAULT_REGIONS[@]}")
fi

#-------------------------------------------------------------------------------
# Check prerequisites
#-------------------------------------------------------------------------------
for cmd in aws jq; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "Error: '$cmd' is required but not installed."
        exit 1
    fi
done

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text 2>/dev/null)
if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo "Error: Could not determine AWS account ID. Check your AWS credentials."
    exit 1
fi

#-------------------------------------------------------------------------------
# Derive defaults from project name
#-------------------------------------------------------------------------------
S3_BUCKET_NAME="${S3_BUCKET_NAME:-${PROJECT_NAME}-frontend-${AWS_ACCOUNT_ID}}"
DYNAMODB_TABLE_NAME="${DYNAMODB_TABLE_NAME:-${PROJECT_NAME}-data}"
COGNITO_USER_POOL_NAME="${COGNITO_USER_POOL_NAME:-${PROJECT_NAME}-user-pool}"
IAM_ROLE_NAME="${IAM_ROLE_NAME:-${PROJECT_NAME}-lambda-execution-role}"

#-------------------------------------------------------------------------------
# Helper Functions
#-------------------------------------------------------------------------------
print_header() {
    echo ""
    echo "=============================================="
    echo "$1"
    echo "=============================================="
    echo ""
}

print_step() {
    echo ">>> $1"
}

print_success() {
    echo "  ✓ $1"
}

print_error() {
    echo "  ✗ $1"
}

print_info() {
    echo "  ℹ $1"
}

confirm() {
    local message=$1
    if [ "$FORCE" = true ]; then
        return 0
    fi
    echo ""
    read -p "$message (y/N): " response
    case "$response" in
        [yY][eE][sS]|[yY]) return 0 ;;
        *) return 1 ;;
    esac
}

ERRORS=0
track_error() {
    ERRORS=$((ERRORS + 1))
    print_error "$1"
}

#===============================================================================
# Regional Cleanup Function
#
# Cleans up region-scoped resources: DynamoDB, Lambda, API Gateway, Cognito,
# S3, and CloudWatch Logs.
#===============================================================================
cleanup_region() {
    local region=$1

    print_header "REGION: ${region}"

    #---------------------------------------------------------------------------
    # DynamoDB
    #---------------------------------------------------------------------------
    print_step "[${region}] Checking DynamoDB..."

    if aws dynamodb describe-table --table-name "$DYNAMODB_TABLE_NAME" --region "$region" >/dev/null 2>&1; then
        print_step "Deleting DynamoDB table: $DYNAMODB_TABLE_NAME"
        if [ "$DRY_RUN" != true ]; then
            aws dynamodb delete-table --table-name "$DYNAMODB_TABLE_NAME" --region "$region" >/dev/null
            print_info "Waiting for table deletion..."
            aws dynamodb wait table-not-exists --table-name "$DYNAMODB_TABLE_NAME" --region "$region" 2>/dev/null || true
            print_success "DynamoDB table deleted"
        else
            echo "  [DRY RUN] Would delete table: $DYNAMODB_TABLE_NAME"
        fi
    else
        print_info "No DynamoDB table found"
    fi

    #---------------------------------------------------------------------------
    # Lambda Functions
    #---------------------------------------------------------------------------
    print_step "[${region}] Checking Lambda functions..."

    LAMBDA_FUNCTIONS=$(aws lambda list-functions \
        --region "$region" \
        --query "Functions[?starts_with(FunctionName, '${PROJECT_NAME}-')].FunctionName" \
        --output text 2>/dev/null || echo "")

    if [ -n "$LAMBDA_FUNCTIONS" ] && [ "$LAMBDA_FUNCTIONS" != "None" ]; then
        for func in $LAMBDA_FUNCTIONS; do
            print_step "Deleting Lambda: $func"
            if [ "$DRY_RUN" != true ]; then
                aws lambda delete-function --function-name "$func" --region "$region" 2>/dev/null && \
                    print_success "Deleted: $func" || track_error "Failed to delete: $func"
            else
                echo "  [DRY RUN] Would delete: $func"
            fi
        done
    else
        print_info "No Lambda functions found matching ${PROJECT_NAME}-*"
    fi

    #---------------------------------------------------------------------------
    # API Gateway
    #---------------------------------------------------------------------------
    print_step "[${region}] Checking API Gateways..."

    API_IDS=$(aws apigatewayv2 get-apis \
        --region "$region" \
        --query "Items[?contains(Name, '${PROJECT_NAME}')].{Id:ApiId,Name:Name}" \
        --output json 2>/dev/null || echo "[]")

    API_COUNT=$(echo "$API_IDS" | jq length 2>/dev/null || echo "0")

    if [ "$API_COUNT" -gt 0 ]; then
        echo "$API_IDS" | jq -r '.[] | .Id + " " + .Name' | while read api_id api_name; do
            print_step "Deleting API Gateway: $api_name ($api_id)"
            if [ "$DRY_RUN" != true ]; then
                aws apigatewayv2 delete-api --api-id "$api_id" --region "$region" 2>/dev/null && \
                    print_success "Deleted: $api_name" || track_error "Failed to delete API: $api_name"
            else
                echo "  [DRY RUN] Would delete: $api_name ($api_id)"
            fi
        done
    else
        print_info "No API Gateways found matching ${PROJECT_NAME}"
    fi

    #---------------------------------------------------------------------------
    # Cognito
    #---------------------------------------------------------------------------
    print_step "[${region}] Checking Cognito..."

    USER_POOL_ID=$(aws cognito-idp list-user-pools \
        --max-results 60 \
        --region "$region" \
        --query "UserPools[?Name=='$COGNITO_USER_POOL_NAME'].Id" \
        --output text 2>/dev/null || echo "")

    if [ -n "$USER_POOL_ID" ] && [ "$USER_POOL_ID" != "None" ]; then
        # Delete domain first (required before pool deletion)
        DOMAIN=$(aws cognito-idp describe-user-pool \
            --user-pool-id "$USER_POOL_ID" \
            --region "$region" \
            --query 'UserPool.Domain' \
            --output text 2>/dev/null || echo "")

        if [ -n "$DOMAIN" ] && [ "$DOMAIN" != "None" ]; then
            print_step "Deleting Cognito domain: $DOMAIN"
            if [ "$DRY_RUN" != true ]; then
                aws cognito-idp delete-user-pool-domain \
                    --domain "$DOMAIN" \
                    --user-pool-id "$USER_POOL_ID" \
                    --region "$region" 2>/dev/null && \
                    print_success "Domain deleted" || track_error "Failed to delete domain"
            else
                echo "  [DRY RUN] Would delete domain: $DOMAIN"
            fi
        fi

        print_step "Deleting User Pool: $USER_POOL_ID"
        if [ "$DRY_RUN" != true ]; then
            aws cognito-idp delete-user-pool \
                --user-pool-id "$USER_POOL_ID" \
                --region "$region" && \
                print_success "User Pool deleted" || track_error "Failed to delete User Pool"
        else
            echo "  [DRY RUN] Would delete User Pool: $USER_POOL_ID"
        fi
    else
        print_info "No Cognito User Pool found"
    fi

    #---------------------------------------------------------------------------
    # S3 (buckets are global but the origin domain is region-specific)
    #---------------------------------------------------------------------------
    print_step "[${region}] Checking S3..."

    if aws s3api head-bucket --bucket "$S3_BUCKET_NAME" >/dev/null 2>&1; then
        # Verify the bucket is actually in this region
        BUCKET_REGION=$(aws s3api get-bucket-location --bucket "$S3_BUCKET_NAME" \
            --query 'LocationConstraint' --output text 2>/dev/null || echo "")
        # AWS returns "None" for us-east-1
        [ "$BUCKET_REGION" = "None" ] || [ -z "$BUCKET_REGION" ] && BUCKET_REGION="us-east-1"

        if [ "$BUCKET_REGION" = "$region" ]; then
            print_step "Emptying S3 bucket: $S3_BUCKET_NAME (including all versions)"
            if [ "$DRY_RUN" != true ]; then
                aws s3 rm "s3://$S3_BUCKET_NAME" --recursive 2>/dev/null || true

                aws s3api list-object-versions --bucket "$S3_BUCKET_NAME" --output json 2>/dev/null | \
                    jq -r '.Versions[]? | "--key \"\(.Key)\" --version-id \(.VersionId)"' | \
                    while read args; do
                        [ -n "$args" ] && eval "aws s3api delete-object --bucket $S3_BUCKET_NAME $args" 2>/dev/null || true
                    done

                aws s3api list-object-versions --bucket "$S3_BUCKET_NAME" --output json 2>/dev/null | \
                    jq -r '.DeleteMarkers[]? | "--key \"\(.Key)\" --version-id \(.VersionId)"' | \
                    while read args; do
                        [ -n "$args" ] && eval "aws s3api delete-object --bucket $S3_BUCKET_NAME $args" 2>/dev/null || true
                    done

                print_step "Deleting S3 bucket: $S3_BUCKET_NAME"
                aws s3api delete-bucket --bucket "$S3_BUCKET_NAME" --region "$region" && \
                    print_success "S3 bucket deleted" || track_error "Failed to delete S3 bucket"
            else
                echo "  [DRY RUN] Would empty and delete bucket: $S3_BUCKET_NAME"
            fi
        else
            print_info "S3 bucket exists but belongs to $BUCKET_REGION, skipping in $region"
        fi
    else
        print_info "No S3 bucket found"
    fi

    #---------------------------------------------------------------------------
    # CloudWatch Log Groups
    #---------------------------------------------------------------------------
    print_step "[${region}] Checking CloudWatch log groups..."

    local ALL_LOG_GROUPS=""

    for prefix in "/aws/lambda/${PROJECT_NAME}" "/aws/apigateway/${PROJECT_NAME}"; do
        FOUND=$(aws logs describe-log-groups \
            --log-group-name-prefix "$prefix" \
            --region "$region" \
            --query "logGroups[].logGroupName" \
            --output text 2>/dev/null || echo "")
        ALL_LOG_GROUPS="$ALL_LOG_GROUPS $FOUND"
    done

    ALL_LOG_GROUPS=$(echo "$ALL_LOG_GROUPS" | xargs)

    if [ -n "$ALL_LOG_GROUPS" ]; then
        for log_group in $ALL_LOG_GROUPS; do
            print_step "Deleting log group: $log_group"
            if [ "$DRY_RUN" != true ]; then
                aws logs delete-log-group --log-group-name "$log_group" --region "$region" 2>/dev/null && \
                    print_success "Deleted: $log_group" || track_error "Failed to delete: $log_group"
            else
                echo "  [DRY RUN] Would delete: $log_group"
            fi
        done
    else
        print_info "No matching CloudWatch log groups found"
    fi
}

#===============================================================================
# Global Cleanup Function
#
# Cleans up global resources: CloudFront, OAC, IAM roles & policies.
# These are not region-scoped and only need to run once.
#===============================================================================
cleanup_global() {
    print_header "GLOBAL RESOURCES (IAM, CloudFront)"

    #---------------------------------------------------------------------------
    # CloudFront (global service - check all regions for S3 origin)
    #---------------------------------------------------------------------------
    print_step "[global] Checking CloudFront distributions..."

    # Try each region's S3 origin domain format
    DIST_ID=""
    for region in "${REGIONS[@]}"; do
        S3_ORIGIN_DOMAIN="${S3_BUCKET_NAME}.s3.${region}.amazonaws.com"
        FOUND_DIST=$(aws cloudfront list-distributions \
            --query "DistributionList.Items[?Origins.Items[?DomainName=='$S3_ORIGIN_DOMAIN']].Id" \
            --output text 2>/dev/null || echo "")
        if [ -n "$FOUND_DIST" ] && [ "$FOUND_DIST" != "None" ]; then
            DIST_ID="$FOUND_DIST"
            break
        fi
    done

    if [ -n "$DIST_ID" ] && [ "$DIST_ID" != "None" ]; then
        IS_ENABLED=$(aws cloudfront get-distribution \
            --id "$DIST_ID" \
            --query "Distribution.DistributionConfig.Enabled" \
            --output text 2>/dev/null || echo "true")

        if [ "$IS_ENABLED" = "true" ]; then
            print_step "Disabling CloudFront distribution: $DIST_ID"
            if [ "$DRY_RUN" != true ]; then
                ETAG=$(aws cloudfront get-distribution-config --id "$DIST_ID" --query 'ETag' --output text)
                CONFIG=$(aws cloudfront get-distribution-config --id "$DIST_ID" --query 'DistributionConfig' --output json)
                DISABLED_CONFIG=$(echo "$CONFIG" | jq '.Enabled = false')
                aws cloudfront update-distribution \
                    --id "$DIST_ID" \
                    --if-match "$ETAG" \
                    --distribution-config "$DISABLED_CONFIG" >/dev/null
                print_info "Waiting for distribution to disable (this takes several minutes)..."
                aws cloudfront wait distribution-deployed --id "$DIST_ID"
                print_success "Distribution disabled"
            else
                echo "  [DRY RUN] Would disable distribution: $DIST_ID"
            fi
        else
            print_info "Distribution already disabled"
        fi

        print_step "Deleting CloudFront distribution: $DIST_ID"
        if [ "$DRY_RUN" != true ]; then
            NEW_ETAG=$(aws cloudfront get-distribution-config --id "$DIST_ID" --query 'ETag' --output text)
            DELETE_OUTPUT=$(aws cloudfront delete-distribution --id "$DIST_ID" --if-match "$NEW_ETAG" 2>&1) && {
                print_success "CloudFront distribution deleted"
            } || {
                if echo "$DELETE_OUTPUT" | grep -q "pricing plan"; then
                    print_info "Distribution disabled but can't be deleted due to pricing plan subscription"
                    print_info "Cancel the plan at: https://console.aws.amazon.com/cloudfront/v4/home#/savings-bundle"
                    print_info "Distribution ID to delete later: $DIST_ID"
                else
                    track_error "Failed to delete distribution: $DELETE_OUTPUT"
                fi
            }
        else
            echo "  [DRY RUN] Would delete distribution: $DIST_ID"
        fi
    else
        print_info "No CloudFront distribution found"
    fi

    # Delete OAC
    OAC_ID=$(aws cloudfront list-origin-access-controls \
        --query "OriginAccessControlList.Items[?Name=='${PROJECT_NAME}-s3-oac'].Id" \
        --output text 2>/dev/null || echo "")

    if [ -n "$OAC_ID" ] && [ "$OAC_ID" != "None" ]; then
        print_step "Deleting Origin Access Control: $OAC_ID"
        if [ "$DRY_RUN" != true ]; then
            OAC_ETAG=$(aws cloudfront get-origin-access-control --id "$OAC_ID" --query 'ETag' --output text 2>/dev/null)
            aws cloudfront delete-origin-access-control --id "$OAC_ID" --if-match "$OAC_ETAG" 2>/dev/null && \
                print_success "OAC deleted" || track_error "Failed to delete OAC"
        else
            echo "  [DRY RUN] Would delete OAC: $OAC_ID"
        fi
    else
        print_info "No OAC found"
    fi

    #---------------------------------------------------------------------------
    # IAM Roles & Policies (global service)
    #---------------------------------------------------------------------------
    print_step "[global] Checking IAM roles..."

    if aws iam get-role --role-name "$IAM_ROLE_NAME" >/dev/null 2>&1; then
        print_step "Detaching all policies from role: $IAM_ROLE_NAME"
        if [ "$DRY_RUN" != true ]; then
            ATTACHED_POLICIES=$(aws iam list-attached-role-policies \
                --role-name "$IAM_ROLE_NAME" \
                --query 'AttachedPolicies[].PolicyArn' \
                --output text 2>/dev/null || echo "")

            for policy_arn in $ATTACHED_POLICIES; do
                [ -z "$policy_arn" ] && continue
                aws iam detach-role-policy \
                    --role-name "$IAM_ROLE_NAME" \
                    --policy-arn "$policy_arn" 2>/dev/null || true
                print_info "Detached: $policy_arn"
            done

            INLINE_POLICIES=$(aws iam list-role-policies \
                --role-name "$IAM_ROLE_NAME" \
                --query 'PolicyNames[]' \
                --output text 2>/dev/null || echo "")

            for policy_name in $INLINE_POLICIES; do
                [ -z "$policy_name" ] && continue
                aws iam delete-role-policy \
                    --role-name "$IAM_ROLE_NAME" \
                    --policy-name "$policy_name" 2>/dev/null || true
                print_info "Deleted inline policy: $policy_name"
            done

            print_step "Deleting IAM role: $IAM_ROLE_NAME"
            aws iam delete-role --role-name "$IAM_ROLE_NAME" && \
                print_success "Role deleted" || track_error "Failed to delete role"
        else
            echo "  [DRY RUN] Would delete role: $IAM_ROLE_NAME"
        fi
    else
        print_info "No IAM role found: $IAM_ROLE_NAME"
    fi

    # Find and delete customer-managed policies matching project name
    print_step "[global] Scanning for IAM policies matching ${PROJECT_NAME}-*"
    POLICY_ARNS=$(aws iam list-policies \
        --scope Local \
        --query "Policies[?starts_with(PolicyName, '${PROJECT_NAME}')].{Arn:Arn,Name:PolicyName}" \
        --output json 2>/dev/null || echo "[]")

    POLICY_COUNT=$(echo "$POLICY_ARNS" | jq length 2>/dev/null || echo "0")

    if [ "$POLICY_COUNT" -gt 0 ]; then
        echo "$POLICY_ARNS" | jq -r '.[] | .Arn + "|" + .Name' | while IFS='|' read policy_arn policy_name; do
            print_step "Deleting IAM policy: $policy_name"
            if [ "$DRY_RUN" != true ]; then
                ENTITIES=$(aws iam list-entities-for-policy --policy-arn "$policy_arn" \
                    --query 'PolicyRoles[].RoleName' --output text 2>/dev/null || echo "")
                for role in $ENTITIES; do
                    [ -z "$role" ] && continue
                    aws iam detach-role-policy --role-name "$role" --policy-arn "$policy_arn" 2>/dev/null || true
                done

                VERSIONS=$(aws iam list-policy-versions \
                    --policy-arn "$policy_arn" \
                    --query "Versions[?!IsDefaultVersion].VersionId" \
                    --output text 2>/dev/null || echo "")
                for version in $VERSIONS; do
                    [ -z "$version" ] && continue
                    aws iam delete-policy-version --policy-arn "$policy_arn" --version-id "$version" 2>/dev/null || true
                done

                aws iam delete-policy --policy-arn "$policy_arn" && \
                    print_success "Policy deleted: $policy_name" || track_error "Failed to delete policy: $policy_name"
            else
                echo "  [DRY RUN] Would delete policy: $policy_name ($policy_arn)"
            fi
        done
    else
        print_info "No matching IAM policies found"
    fi
}

#===============================================================================
# Main Execution
#===============================================================================
print_header "NUCLEAR CLEANUP - ${PROJECT_NAME}"

echo "!!! WARNING: This will DELETE ALL ${PROJECT_NAME} AWS resources !!!"
echo ""
echo "Project:         $PROJECT_NAME"
echo "Account ID:      $AWS_ACCOUNT_ID"
echo "Regions:         ${REGIONS[*]}"
echo "S3 Bucket:       $S3_BUCKET_NAME"
echo "DynamoDB Table:  $DYNAMODB_TABLE_NAME"
echo "Cognito Pool:    $COGNITO_USER_POOL_NAME"
echo "IAM Role:        $IAM_ROLE_NAME"
[ -n "$CONFIG_DIR" ] && echo "Config Dir:      $CONFIG_DIR"
echo ""

if [ "$DRY_RUN" = true ]; then
    echo "=== DRY RUN MODE - No changes will be made ==="
    echo ""
fi

if [ "$FORCE" != true ] && [ "$DRY_RUN" != true ]; then
    echo "This will permanently delete across ${#REGIONS[@]} region(s): ${REGIONS[*]}"
    echo ""
    echo "  - All Lambda functions matching ${PROJECT_NAME}-*"
    echo "  - All CloudWatch log groups matching ${PROJECT_NAME}"
    echo "  - API Gateways matching ${PROJECT_NAME}"
    echo "  - Cognito User Pool: $COGNITO_USER_POOL_NAME"
    echo "  - CloudFront distribution + OAC"
    echo "  - S3 bucket: $S3_BUCKET_NAME (all versions)"
    echo "  - DynamoDB table: $DYNAMODB_TABLE_NAME"
    echo "  - IAM role: $IAM_ROLE_NAME + associated policies"
    echo ""
    if ! confirm "TYPE 'y' TO NUKE EVERYTHING"; then
        echo "Cleanup cancelled."
        exit 0
    fi
fi

# Run regional cleanup for each region
for region in "${REGIONS[@]}"; do
    cleanup_region "$region"
done

# Run global cleanup once (IAM, CloudFront)
cleanup_global

# Cleanup generated config files (optional)
if [ -n "$CONFIG_DIR" ]; then
    print_header "Cleanup Config Files"

    if [ -d "$CONFIG_DIR" ]; then
        print_step "Removing config directory: $CONFIG_DIR"
        if [ "$DRY_RUN" != true ]; then
            rm -rf "$CONFIG_DIR"
            print_success "Config directory removed"
        else
            echo "  [DRY RUN] Would remove: $CONFIG_DIR"
        fi
    else
        print_info "Config directory not found: $CONFIG_DIR"
    fi
fi

#===============================================================================
# Summary
#===============================================================================
print_header "NUCLEAR CLEANUP COMPLETE"

if [ "$DRY_RUN" = true ]; then
    echo "Dry run complete. No changes were made."
    echo "Regions scanned: ${REGIONS[*]}"
    echo "Run without --dry-run to execute the cleanup."
else
    if [ "$ERRORS" -gt 0 ]; then
        echo "Cleanup finished with $ERRORS error(s). Review the output above."
    else
        echo "All ${PROJECT_NAME} resources have been obliterated."
    fi
    echo "Regions cleaned: ${REGIONS[*]}"
    echo ""
    echo "Note: CloudFront distributions may take a few minutes to fully"
    echo "propagate. If a distribution had a pricing plan, it was disabled"
    echo "but must be manually deleted after cancelling the plan."
fi
