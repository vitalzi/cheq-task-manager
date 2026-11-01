output "alb_url" {
  description = "API base URL; use as VITE_API_URL"
  value       = "http://${aws_lb.api.dns_name}"
}

output "s3_website_url" {
  description = "Frontend URL"
  value       = "http://${aws_s3_bucket_website_configuration.frontend.website_endpoint}"
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
