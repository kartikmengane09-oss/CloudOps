'use strict';

const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand
} = require('@aws-sdk/client-s3');

const BUCKET_NAME = 'cloudops-deploypilot-bucket';
const OBJECT_KEY = 'deployments/deployments.json';
const REGION = 'eu-north-1';

const s3 = new S3Client({
  region: REGION
});

async function uploadDeployments(deployments) {
  const body = JSON.stringify(deployments, null, 2);

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: OBJECT_KEY,
      Body: body,
      ContentType: 'application/json'
    })
  );

  console.log(
    `[S3] Uploaded deployment history to s3://${BUCKET_NAME}/${OBJECT_KEY}`
  );
}

async function downloadDeployments() {
  const response = await s3.send(
    new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: OBJECT_KEY
    })
  );

  const body = await response.Body.transformToString();

  return JSON.parse(body);
}

module.exports = {
  uploadDeployments,
  downloadDeployments
};
