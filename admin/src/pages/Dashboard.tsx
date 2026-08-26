import { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Table, Button, Space, message, Typography, Popconfirm } from 'antd';
import { ReloadOutlined, ThunderboltOutlined, RestOutlined } from '@ant-design/icons';
import { callAdmin } from '../api';

interface ApiStat {
  _id?: string;
  service?: string;
  type?: string;
  latencyMs?: number;
  tokens?: number;
  createdAt?: string;
  [k: string]: any;
}

export default function Dashboard() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    const res = await callAdmin('stats/dashboard');
    setLoading(false);
    if (res.success) setData(res);
    else message.error(res.error || '加载失败');
  };

  useEffect(() => {
    load();
  }, []);

  const onReset = async () => {
    const res = await callAdmin('reset');
    if (res.success) {
      message.success(res.message || '已重置');
      load();
    } else message.error(res.error || '重置失败');
  };

  const onSimulate = async (type: string) => {
    const res = await callAdmin('simulate-api-call', { type });
    if (res.success) {
      message.success('已写入模拟调用数据');
      load();
    } else message.error(res.error || '失败');
  };

  const counts = data?.counts || { users: 0, stories: 0, voices: 0 };
  const apiStats: ApiStat[] = data?.apiStats || [];

  const columns = [
    { title: '服务', dataIndex: 'service', key: 'service' },
    { title: '类型', dataIndex: 'type', key: 'type' },
    {
      title: '耗时(ms)',
      dataIndex: 'latencyMs',
      key: 'latencyMs',
      render: (v: number) => (v != null ? v : '-'),
    },
    {
      title: 'Tokens',
      dataIndex: 'tokens',
      key: 'tokens',
      render: (v: number) => (v != null ? v : '-'),
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          数据概览
        </Typography.Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            刷新
          </Button>
          <Popconfirm title="确认重置全局配置（模板/统计/审计日志）？用户数据不受影响。" onConfirm={onReset}>
            <Button icon={<RestOutlined />} danger>
              重置配置
            </Button>
          </Popconfirm>
        </Space>
      </Space>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card>
            <Statistic title="用户数" value={counts.users} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="故事数" value={counts.stories} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="声纹数" value={counts.voices} />
          </Card>
        </Col>
      </Row>

      <Card
        title="API 调用模拟"
        extra={
          <Space>
            <Button size="small" icon={<ThunderboltOutlined />} onClick={() => onSimulate('gemini')}>
              StepFun 文本
            </Button>
            <Button size="small" icon={<ThunderboltOutlined />} onClick={() => onSimulate('tts')}>
              StepFun TTS
            </Button>
            <Button size="small" icon={<ThunderboltOutlined />} onClick={() => onSimulate('clone')}>
              声音克隆
            </Button>
          </Space>
        }
      >
        <Table rowKey={(r: any) => r._id || Math.random()} dataSource={apiStats} columns={columns} pagination={false} size="small" />
      </Card>
    </div>
  );
}
