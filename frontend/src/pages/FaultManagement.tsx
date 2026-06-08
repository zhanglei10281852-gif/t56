import { useState, useEffect } from 'react'
import {
  Table,
  Button,
  Modal,
  Form,
  Select,
  Input,
  Space,
  Tag,
  message,
  Typography,
  Card,
  Row,
  Col,
  Statistic,
} from 'antd'
import {
  PlusOutlined,
  ToolOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import {
  getFaultReportList,
  createFaultReport,
  handleFaultMaintenance,
  FaultReport,
} from '@/api/fault'
import dayjs from 'dayjs'

const { Title } = Typography
const { Option } = Select
const { TextArea } = Input

const FaultManagement = () => {
  const [reports, setReports] = useState<FaultReport[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [modalVisible, setModalVisible] = useState(false)
  const [maintainModalVisible, setMaintainModalVisible] = useState(false)
  const [currentReport, setCurrentReport] = useState<FaultReport | null>(null)
  const [form] = Form.useForm()
  const [maintainForm] = Form.useForm()

  const loadReports = async () => {
    setLoading(true)
    try {
      const res = await getFaultReportList({
        page,
        pageSize,
        status: statusFilter,
      })
      setReports(res.list)
      setTotal(res.total)
    } catch (error) {
      console.error('加载故障报修失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReports()
  }, [page, pageSize, statusFilter])

  const handleCreate = async (values: any) => {
    try {
      await createFaultReport({
        bike_code: values.bikeCode,
        fault_type: values.faultType,
        description: values.description,
        reporter_phone: values.reporterPhone,
      })
      message.success('故障报修提交成功')
      setModalVisible(false)
      form.resetFields()
      loadReports()
    } catch (error) {
      console.error('提交故障报修失败:', error)
    }
  }

  const handleStartMaintenance = (record: FaultReport) => {
    setCurrentReport(record)
    maintainForm.setFieldsValue({
      maintenanceStaff: '维修员',
    })
    setMaintainModalVisible(true)
  }

  const handleCompleteMaintenance = (record: FaultReport) => {
    setCurrentReport(record)
    maintainForm.setFieldsValue({
      maintenanceResult: '维修完成，车辆已恢复正常',
    })
    setMaintainModalVisible(true)
  }

  const handleMaintainSubmit = async (values: any) => {
    if (!currentReport) return

    const action = currentReport.status === '待处理' ? '开始维修' : '完成维修'

    try {
      await handleFaultMaintenance(
        currentReport.id,
        action,
        values.maintenanceStaff,
        values.maintenanceResult
      )
      message.success('操作成功')
      setMaintainModalVisible(false)
      maintainForm.resetFields()
      setCurrentReport(null)
      loadReports()
    } catch (error) {
      console.error('操作失败:', error)
    }
  }

  const getStatusTag = (status: string) => {
    const colorMap: Record<string, string> = {
      '待处理': 'red',
      '维修中': 'orange',
      '已完成': 'green',
    }
    return <Tag color={colorMap[status] || 'default'}>{status}</Tag>
  }

  const getFaultTypeTag = (type: string) => {
    const colorMap: Record<string, string> = {
      '刹车': 'red',
      '轮胎': 'orange',
      '锁具': 'blue',
      '链条': 'purple',
      '电池': 'green',
      '其他': 'default',
    }
    return <Tag color={colorMap[type] || 'default'}>{type}</Tag>
  }

  const pendingCount = reports.filter(r => r.status === '待处理').length
  const repairingCount = reports.filter(r => r.status === '维修中').length
  const completedCount = reports.filter(r => r.status === '已完成').length

  const columns = [
    {
      title: '报修编号',
      dataIndex: 'reportCode',
      key: 'reportCode',
      width: 100,
    },
    {
      title: '车辆编号',
      dataIndex: 'bikeCode',
      key: 'bikeCode',
      width: 100,
    },
    {
      title: '故障类型',
      dataIndex: 'faultType',
      key: 'faultType',
      width: 100,
      render: (type: string) => getFaultTypeTag(type),
    },
    {
      title: '故障描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '上报人',
      dataIndex: 'reporterPhone',
      key: 'reporterPhone',
      width: 120,
    },
    {
      title: '上报时间',
      dataIndex: 'reportTime',
      key: 'reportTime',
      width: 160,
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '所在站点',
      dataIndex: 'stationName',
      key: 'stationName',
      width: 120,
      render: (text: string) => text || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '维修人员',
      dataIndex: 'maintenanceStaff',
      key: 'maintenanceStaff',
      width: 100,
      render: (text: string) => text || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: FaultReport) => (
        <Space size="small">
          {record.status === '待处理' && (
            <Button
              type="link"
              size="small"
              icon={<ToolOutlined />}
              onClick={() => handleStartMaintenance(record)}
            >
              开始维修
            </Button>
          )}
          {record.status === '维修中' && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleCompleteMaintenance(record)}
            >
              完成维修
            </Button>
          )}
        </Space>
      ),
    },
  ]

  const statusFilters = [
    { text: '全部状态', value: undefined },
    { text: '待处理', value: '待处理' },
    { text: '维修中', value: '维修中' },
    { text: '已完成', value: '已完成' },
  ]

  const faultTypes = ['刹车', '轮胎', '锁具', '链条', '电池', '其他']

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="待处理故障"
              value={pendingCount}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="维修中"
              value={repairingCount}
              valueStyle={{ color: '#fa8c16' }}
              prefix={<ToolOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="已修复"
              value={completedCount}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0 }}>
            故障报修管理
          </Title>
          <Space>
            <Space>
              <span style={{ color: '#666' }}>状态筛选:</span>
              <Select
                style={{ width: 120 }}
                value={statusFilter}
                onChange={setStatusFilter}
                allowClear
                placeholder="全部状态"
              >
                {statusFilters.map(s => (
                  <Option key={s.value || 'all'} value={s.value}>
                    {s.text}
                  </Option>
                ))}
              </Select>
            </Space>
            <Button icon={<ReloadOutlined />} onClick={loadReports}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
              新增报修
            </Button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={reports}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
        />
      </Card>

      <Modal
        title="新增故障报修"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            label="车辆编号"
            name="bikeCode"
            rules={[{ required: true, message: '请输入车辆编号' }]}
          >
            <Input placeholder="请输入车辆编号，如 B00001" />
          </Form.Item>

          <Form.Item
            label="故障类型"
            name="faultType"
            rules={[{ required: true, message: '请选择故障类型' }]}
          >
            <Select placeholder="请选择故障类型">
              {faultTypes.map(type => (
                <Option key={type} value={type}>
                  {type}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="故障描述" name="description">
            <TextArea rows={3} placeholder="请描述故障详情" />
          </Form.Item>

          <Form.Item label="上报人电话" name="reporterPhone">
            <Input placeholder="请输入上报人手机号" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                提交报修
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={currentReport?.status === '待处理' ? '开始维修' : '完成维修'}
        open={maintainModalVisible}
        onCancel={() => {
          setMaintainModalVisible(false)
          setCurrentReport(null)
        }}
        footer={null}
        width={500}
      >
        <Form form={maintainForm} layout="vertical" onFinish={handleMaintainSubmit}>
          <Form.Item label="维修人员" name="maintenanceStaff">
            <Input placeholder="请输入维修人员姓名" />
          </Form.Item>

          {currentReport?.status !== '待处理' && (
            <Form.Item label="维修结果" name="maintenanceResult">
              <TextArea rows={3} placeholder="请输入维修结果描述" />
            </Form.Item>
          )}

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setMaintainModalVisible(false)
                setCurrentReport(null)
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                确认
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default FaultManagement
