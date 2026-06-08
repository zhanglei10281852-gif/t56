import { useState } from 'react'
import { Form, Input, Button, Card, message } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { login } from '@/api/auth'
import { useAuthStore } from '@/store/auth'

const Login = () => {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { token, setToken, setUserInfo } = useAuthStore()

  if (token) {
    return <Navigate to="/" replace />
  }

  const from = (location.state as any)?.from || '/'

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      const result = await login(values)
      setToken(result.token)
      setUserInfo(result.userInfo)
      message.success('登录成功')
      navigate(from, { replace: true })
    } catch (error) {
      console.error('登录失败:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <Card className="login-card" bordered={false}>
        <div className="login-title">
          <h2>🚲 公共自行车管理平台</h2>
          <p>城市公共自行车运营调度系统</p>
        </div>
        <Form
          name="login"
          onFinish={onFinish}
          initialValues={{ username: 'admin', password: 'bike@2024' }}
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              登 录
            </Button>
          </Form.Item>
        </Form>
        <div style={{ textAlign: 'center', color: '#999', fontSize: '12px' }}>
          <p>管理员: admin / bike@2024</p>
          <p>调度员: dispatcher1~3 / dp888</p>
        </div>
      </Card>
    </div>
  )
}

export default Login
