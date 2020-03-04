resource "aws_iam_role" "tileserver_role" {
  name = "tileserver_role"

  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "sts:AssumeRole",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Effect": "Allow",
      "Sid": ""
    }
  ]
}
EOF
  tags = {
    tag-key = "tag-value"
  }
}

resource "aws_iam_role_policy_attachment" "exec-role" {
  role = "${aws_iam_role.tileserver_role.name}"
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy_attachment" "S3FullAccess" {
    role       = "${aws_iam_role.tileserver_role.name}"
    policy_arn = "arn:aws:iam::aws:policy/AmazonS3FullAccess"
}

resource "aws_lambda_layer_version" "tileserver_layer" {
  filename = "../dist/tileserver_layer.zip"
  layer_name = "tileserver_layer"
  source_code_hash = "${filebase64sha256("../dist/tileserver_layer.zip")}"
  compatible_runtimes = ["nodejs10.x"]
}

resource "aws_lambda_function" "tileserver" {
  function_name = "tileserver"
  runtime = "nodejs10.x"
  filename = "./../dist/function.zip"
  role = "${aws_iam_role.tileserver_role.arn}"
  handler = "index.handler"
  timeout = 30
  source_code_hash = "${filebase64sha256("./../dist/function.zip")}"
  layers = ["${aws_lambda_layer_version.tileserver_layer.arn}"]
  vpc_config {
    subnet_ids = ["subnet-0fd5e742", "subnet-19dd2d73", "subnet-81d6f9fc"]
    security_group_ids = ["sg-61e63b00"]
  }
  environment {
    variables = {
      PGHOST = "${var.postgres_host}"
      PGPASSWORD = "${var.postgres_password}"
      PGUSER = "${var.postgres_user}"
      CACHE_BUCKET = "${aws_s3_bucket.tilecache.id}"
      LOG_LEVEL = "${var.log_level}"
    }
  }
}

resource "aws_lambda_permission" "allow_api_gateway" {
     statement_id  = "AllowExecutionFromAPIGateway"
     action        = "lambda:InvokeFunction"
     function_name = "${aws_lambda_function.tileserver.function_name}"
     principal     = "apigateway.amazonaws.com"
     source_arn = "${aws_api_gateway_rest_api.tileserver.execution_arn}/*/*/*"
     
}
