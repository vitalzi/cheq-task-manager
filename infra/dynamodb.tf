# On demand: no capacity to size, and nothing is billed while the table is idle
resource "aws_dynamodb_table" "tasks" {
  name         = "${var.project}-tasks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }
}

# Only the table, only what DynamoTaskStore calls: a scan to list, a put to create,
# an update and a delete by id.
resource "aws_iam_role_policy" "task_dynamodb" {
  name = "tasks-table"
  role = aws_iam_role.task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["dynamodb:Scan", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem"]
      Resource = aws_dynamodb_table.tasks.arn
    }]
  })
}
