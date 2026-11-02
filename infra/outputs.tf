output "alb_url" {
  description = "Direct API address; no longer the entry point, use cloudfront_url"
  value       = "http://${aws_lb.api.dns_name}"
}

output "cloudfront_url" {
  description = "Site and API entry point (HTTPS)"
  value       = "https://${aws_cloudfront_distribution.main.domain_name}"
}

# Needed by the frontend workflow for cache invalidation (task 20)
output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.main.id
}

output "ecr_repository_url" {
  value = aws_ecr_repository.api.repository_url
}

# Needed by the CI workflows (tasks 15 and 16)
output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  value = aws_ecs_service.api.name
}

output "frontend_bucket_name" {
  value = aws_s3_bucket.frontend.bucket
}

output "ci_role_arn" {
  description = "IAM role GitHub Actions assumes; set as a GitHub repository variable"
  value       = aws_iam_role.ci.arn
}
