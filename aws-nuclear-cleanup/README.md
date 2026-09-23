# AWS Nuclear Cleanup

A standalone bash script that removes all AWS resources for a given project prefix. Designed for projects that follow the naming convention `{project-name}-{resource}`.

## What It Deletes

| Resource | Scope | How It Finds Them |
|----------|-------|-------------------|
| **DynamoDB** | Regional | Table name: `{project}-data` (or custom) |
| **Lambda Functions** | Regional | All functions matching `{project}-*` |
| **API Gateway** | Regional | All HTTP APIs matching `{project}` |
| **Cognito** | Regional | User Pool named `{project}-user-pool` (or custom), including hosted domain |
| **S3** | Regional | Bucket named `{project}-frontend-{account-id}` (or custom), including all object versions and delete markers. Only deleted in the region where the bucket lives. |
| **CloudWatch Logs** | Regional | All log groups under `/aws/lambda/{project}-*` and `/aws/apigateway/{project}-*` |
| **CloudFront** | Global | Distribution linked to the project's S3 bucket origin (checks all target regions) |
| **IAM** | Global | Execution role `{project}-lambda-execution-role` (or custom) + all customer-managed policies matching `{project}-*` |

## Requirements

- [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) configured with valid credentials
- [jq](https://jqlang.github.io/jq/download/) for JSON parsing

## Usage

```bash
# Sweep both us-east-1 and us-east-2 (default when no region specified)
./nuclear-cleanup.sh --project my-app --dry-run

# Target a single region
./nuclear-cleanup.sh --project my-app --region us-east-2

# Skip all confirmations (dangerous!)
./nuclear-cleanup.sh --project my-app --force
```

## Multi-Region Behavior

When `--region` is **not provided**, the script automatically sweeps both `us-east-1` and `us-east-2`:

- **Regional resources** (DynamoDB, Lambda, API Gateway, Cognito, S3, CloudWatch Logs) are cleaned up independently in each region
- **Global resources** (IAM, CloudFront) are cleaned up once after all regions are processed
- **S3 buckets** are only deleted in the region where they actually live (detected via `get-bucket-location`)

When `--region` **is provided**, only that single region is targeted.

## Arguments

### Required

| Flag | Description |
|------|-------------|
| `--project, -p` | Project name prefix (e.g., `my-app`) |

### Optional

| Flag | Description |
|------|-------------|
| `--region, -r` | AWS region (default: sweeps `us-east-1` and `us-east-2`) |

### Optional Overrides

These are auto-derived from `--project` if not provided:

| Flag | Default | Description |
|------|---------|-------------|
| `--s3-bucket` | `{project}-frontend-{account-id}` | S3 bucket name |
| `--dynamodb-table` | `{project}-data` | DynamoDB table name |
| `--cognito-pool` | `{project}-user-pool` | Cognito User Pool name |
| `--iam-role` | `{project}-lambda-execution-role` | Lambda execution role name |
| `--config-dir` | *(none)* | Local config directory to remove |

### Flags

| Flag | Description |
|------|-------------|
| `--dry-run` | Show what would be deleted without executing |
| `--force` | Skip all confirmation prompts |
| `--help, -h` | Show help message |

## Examples

### Multi-region sweep (default)

```bash
# Preview what would be deleted across us-east-1 and us-east-2
./nuclear-cleanup.sh --project debt-tracker --dry-run
```

### Single region

```bash
./nuclear-cleanup.sh --project debt-tracker --region us-east-2
```

### Custom resource names

```bash
./nuclear-cleanup.sh \
  --project my-app \
  --region us-west-2 \
  --s3-bucket my-custom-bucket \
  --dynamodb-table my-custom-table \
  --cognito-pool my-auth-pool \
  --iam-role my-lambda-role \
  --config-dir ./generated
```

### CI/CD pipeline usage

```bash
./nuclear-cleanup.sh --project staging-app --force
```

## How It Works

The script splits cleanup into regional and global phases:

### Regional (runs per region)
1. **DynamoDB** - Delete table and wait for completion
2. **Lambda** - Discover and delete all matching functions
3. **API Gateway** - Find and delete all matching HTTP APIs
4. **Cognito** - Delete hosted domain first, then the User Pool
5. **S3** - Verify bucket belongs to this region, empty (including versions), delete
6. **CloudWatch Logs** - Sweep and delete all matching log groups

### Global (runs once)
7. **CloudFront** - Search across all target regions for S3 origin, disable distribution, wait for propagation, delete distribution and OAC
8. **IAM** - Detach all policies (managed + inline), delete role, scan and delete all matching customer-managed policies

## Notes

- The script auto-detects your AWS Account ID via `aws sts get-caller-identity`
- CloudFront distributions take several minutes to disable before they can be deleted
- If a CloudFront distribution is subscribed to a pricing plan (e.g., Security Bundle), the script will disable it but cannot delete it. You'll need to cancel the plan in the AWS Console first
- IAM policies are automatically detached from roles and have non-default versions cleaned up before deletion
- The `--config-dir` flag is optional and only needed if your project generates local config files during infrastructure setup

## License

MIT
