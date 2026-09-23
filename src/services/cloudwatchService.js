'use strict';

const {
  CloudWatchClient,
  GetMetricStatisticsCommand
} = require('@aws-sdk/client-cloudwatch');

const REGION =
  process.env.AWS_REGION ||
  process.env.AWS_DEFAULT_REGION ||
  'eu-north-1';

const INSTANCE_ID = process.env.EC2_INSTANCE_ID || 'i-0efcf9ec0be1cadc9';

const cloudWatch = new CloudWatchClient({
  region: REGION
});

async function getMetric({
  namespace,
  metricName,
  dimensions
}) {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 10 * 60 * 1000);

  const command = new GetMetricStatisticsCommand({
    Namespace: namespace,
    MetricName: metricName,
    Dimensions: dimensions,
    Statistics: ['Average'],
    Period: 300,
    StartTime: startTime,
    EndTime: endTime
  });

  const response = await cloudWatch.send(command);

  if (!response.Datapoints || response.Datapoints.length === 0) {
    return null;
  }

  // CloudWatch datapoints are not guaranteed to arrive sorted.
  const latest = response.Datapoints.sort(
    (a, b) => new Date(b.Timestamp) - new Date(a.Timestamp)
  )[0];

  return latest.Average ?? null;
}

async function getSystemMetrics() {
  const [cpu, memory, disk] = await Promise.all([
    getMetric({
      namespace: 'AWS/EC2',
      metricName: 'CPUUtilization',
      dimensions: [
        {
          Name: 'InstanceId',
          Value: INSTANCE_ID
        }
      ]
    }),

    getMetric({
      namespace: 'DeployPilot/System',
      metricName: 'mem_used_percent',
      dimensions: [
        {
          Name: 'InstanceId',
          Value: INSTANCE_ID
        }
      ]
    }),

    getMetric({
      namespace: 'DeployPilot/System',
      metricName: 'disk_used_percent',
      dimensions: [
        {
          Name: 'path',
          Value: '/'
        },
        {
          Name: 'InstanceId',
          Value: INSTANCE_ID
        },
        {
          Name: 'device',
          Value: 'nvme0n1p1'
        },
        {
          Name: 'fstype',
          Value: 'ext4'
        }
      ]
    })
  ]);

  return {
    cpu,
    memory,
    disk,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  getSystemMetrics
};