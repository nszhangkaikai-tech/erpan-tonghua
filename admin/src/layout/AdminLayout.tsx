import { Layout, Menu, Button, Typography } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  UserOutlined,
  BookOutlined,
  AudioOutlined,
  KeyOutlined,
  AppstoreOutlined,
  SafetyOutlined,
  NotificationOutlined,
  LogoutOutlined,
  RobotOutlined,
  AppstoreAddOutlined,
  ProfileOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { clearToken } from '../auth';

const { Sider, Header, Content } = Layout;

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '概览' },
  { key: '/admins', icon: <TeamOutlined />, label: '管理员管理' },
  { key: '/users', icon: <UserOutlined />, label: '用户管理' },
  { key: '/stories', icon: <BookOutlined />, label: '故事管理' },
  { key: '/voice', icon: <AudioOutlined />, label: '声纹管理' },
  { key: '/cdkeys', icon: <KeyOutlined />, label: '兑换码' },
  { key: '/templates', icon: <AppstoreOutlined />, label: '模板管理' },
  { key: '/safety', icon: <SafetyOutlined />, label: '安全词配置' },
  { key: '/notifications', icon: <NotificationOutlined />, label: '通知管理' },
  { key: '/theme-config', icon: <AppstoreAddOutlined />, label: '主题配置' },
  { key: '/authors', icon: <ProfileOutlined />, label: '故事作者' },
  { key: '/ai-config', icon: <RobotOutlined />, label: 'AI 模型监控' },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const seg = location.pathname.split('/')[1] || 'dashboard';
  const selectedKey = '/' + seg;

  const handleLogout = () => {
    clearToken();
    navigate('/login');
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="dark" breakpoint="lg" collapsedWidth="0">
        <div style={{ color: '#fff', padding: '16px 12px', fontWeight: 700, fontSize: 16, lineHeight: 1.4 }}>
          耳畔童话
          <div style={{ fontSize: 12, fontWeight: 400, opacity: 0.7 }}>管理后台</div>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          onClick={({ key }) => navigate(key)}
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            padding: '0 24px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}
        >
          <Typography.Text type="secondary" style={{ marginRight: 16 }}>
            管理员：admin
          </Typography.Text>
          <Button icon={<LogoutOutlined />} onClick={handleLogout}>
            退出登录
          </Button>
        </Header>
        <Content style={{ margin: 16, padding: 24, background: '#fff', borderRadius: 8, minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
