import { useState } from 'react';
import { Card, Form, Input, Button, message, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { callAdmin } from '../api';
import { setToken } from '../auth';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const res = await callAdmin('login', values);
      if (res.success && res.adminToken) {
        setToken(res.adminToken);
        message.success('登录成功');
        navigate('/dashboard');
      } else {
        message.error(res.error || '登录失败');
      }
    } catch (e: any) {
      message.error('网络错误：' + (e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f0f2f5',
      }}
    >
      <Card style={{ width: 360 }} bordered>
        <Typography.Title level={3} style={{ textAlign: 'center', marginBottom: 24 }}>
          耳畔童话管理后台
        </Typography.Title>
        <Form layout="vertical" onFinish={onFinish} initialValues={{ username: 'admin' }}>
          <Form.Item name="username" label="管理员账号" rules={[{ required: true, message: '请输入账号' }]}>
            <Input placeholder="admin" autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password placeholder="请输入密码" autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            登录
          </Button>
        </Form>
        <Typography.Paragraph type="secondary" style={{ marginTop: 16, fontSize: 12, textAlign: 'center', marginBottom: 0 }}>
          仅授权管理员可访问；操作会被记录
        </Typography.Paragraph>
      </Card>
    </div>
  );
}
