resource "aws_ecr_repository" "api" {
  name = "${var.project}-api"

  # CI pushes `latest` on every deploy
  image_tag_mutability = "MUTABLE"

  # Lets `terraform destroy` remove the repo even when it holds images
  force_delete = true
}
