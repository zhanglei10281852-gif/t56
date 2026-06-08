import { Layout, Menu, Avatar, Dropdown, Space, Typography } from 'antd'
import {
  DashboardOutlined,
  CarOutlined,
  ThunderboltOutlined,
  ToolOutlined,
  BarChartOutlined,
  UserOutlined,
  LogoutOutlined,
  SafetyOutlined,
} from '@ant-design/icons'
import { useLocation, useNavigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { useState, useEffect } from 'react'

const { Header, Sider, Content } = Layout
const { Title } = Typography

const MainLayout = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { userInfo, logout } = useAuthStore()
  const [collapsed, setCollapsed] = useState(false)
  const [selectedKey, setSelectedKey] = useState('/stations')

  useEffect(() => {
    const path = location.pathname.split('/')[1]
    setSelectedKey(`/${path}`)
  }, [location.pathname])

  const menuItems = [
    {
      key: '/stations',
      icon: <DashboardOutlined />,
      label: '站点总览',
    },
    {
      key: '/dispatch',
      icon: <CarOutlined />,
      label: '调度任务',
    },
    {
      key: '/ride',
      icon: <ThunderboltOutlined />,
      label: '骑行数据',
    },
    {
      key: '/fault',
      icon: <ToolOutlined />,
      label: '故障管理',
    },
    {
      key: '/statistics',
      icon: <BarChartOutlined />,
      label: '统计分析',
    },
  ]

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const userMenuItems = [
    {
      key: '1',
      icon: <UserOutlined />,
      label: `${userInfo?.realName || userInfo?.username}`,
      disabled: true,
    },
    {
      key: '2',
      icon: <SafetyOutlined />,
      label: userInfo?.role === 'admin' ? '管理员' : `调度员 (${userInfo?.district})`,
      disabled: true,
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: collapsed ? 14 : 18,
            fontWeight: 'bold',
            background: 'rgba(255,255,255,0.1)',
          }}
        >
          {collapsed ? '🚲' : '🚲 自行车调度'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          }}
        >
          <Title level={4} style={{ margin: 0, color: '#1677ff' }}>
            城市公共自行车运营管理平台
          </Title>
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#1677ff' }} />
              <span>{userInfo?.realName || userInfo?.username}</span>
            </Space>
          </Dropdown>
        </Header>
        <Content
          style={{
            margin: '24px',
            padding: 0,
            minHeight: 'calc(100vh - 112px)',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

export default MainLayout
