# GitHub puts the owner and repository IDs into the token's `sub` claim for this
# repo, so a deleted and re-created repo with the same name cannot reuse the role.
# Read it with: gh api repos/<owner>/<repo>/actions/oidc/customization/sub
variable "github_sub_prefix" {
  description = "Start of the OIDC sub claim GitHub issues for the deploying repository"
  type        = string
  default     = "repo:vitalzi@80326103/cheq-task-manager@1442180647"
}

# Lets GitHub Actions prove its identity to AWS with a short-lived token,
# so no AWS access keys are stored in GitHub. One provider per account.
resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

resource "aws_iam_role" "ci" {
  name = "${var.project}-ci"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRoleWithWebIdentity"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          # Only workflow runs on this repo's main branch can assume the role
          "token.actions.githubusercontent.com:sub" = "${var.github_sub_prefix}:ref:refs/heads/main"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "ci" {
  name = "deploy"
  role = aws_iam_role.ci.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # The login token call does not support resource-level permissions
        Sid      = "EcrLogin"
        Effect   = "Allow"
        Action   = "ecr:GetAuthorizationToken"
        Resource = "*"
      },
      {
        Sid    = "EcrPush"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:PutImage",
          # Docker checks the manifest with a HEAD request before finishing a push
          "ecr:BatchGetImage",
        ]
        Resource = aws_ecr_repository.api.arn
      },
      {
        Sid    = "EcsRollout"
        Effect = "Allow"
        # DescribeServices is what `aws ecs wait services-stable` polls
        Action   = ["ecs:UpdateService", "ecs:DescribeServices"]
        Resource = aws_ecs_service.api.id # for a service, id is the ARN
      },
      {
        Sid      = "FrontendList"
        Effect   = "Allow"
        Action   = "s3:ListBucket"
        Resource = aws_s3_bucket.frontend.arn
      },
      {
        Sid      = "FrontendWrite"
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:DeleteObject"]
        Resource = "${aws_s3_bucket.frontend.arn}/*"
      },
    ]
  })
}
