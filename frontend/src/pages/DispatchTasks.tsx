import { useState, useEffect } from 'react'
import {
  Table,
  Button,
  Modal,
  Form,
  Select,
  Input,
  DatePicker,
  InputNumber,
  Space,
  Tag,
  message,
  Typography,
  Popconfirm,
  Card,
} from 'antd'
import {
  PlusOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import {
  getDispatchTaskList,
  createDispatchTask,
  updateDispatchTaskStatus,
  deleteDispatchTask,
  DispatchTask,
} from '@/api/dispatch'
import { getStationList, Station } from '@/api/stations'
import { useAuthStore } from '@/store/auth'
import dayjs from 'dayjs'

const { Title } = Typography
const { Option } = Select
const { TextArea } = Input

const DispatchTasks = () => {
  const [tasks, setTasks] = useState<DispatchTask[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()
  const [stations, setStations] = useState<Station[]>([])
  const { userInfo } = useAuthStore()

  const loadTasks = async () => {
    setLoading(true)
    try {
      const res = await getDispatchTaskList({
        page,
        pageSize,
        status: statusFilter,
      })
      setTasks(res.list)
      setTotal(res.total)
    } catch (error) {
      console.error('加载调度任务失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStations = async () => {
    try {
      const res = await getStationList({ pageSize: 100 })
      setStations(res.list)
    } catch (error) {
      console.error('加载站点列表失败:', error)
    }
  }

  useEffect(() => {
    loadTasks()
    loadStations()
  }, [page, pageSize, statusFilter])

  const handleCreate = async (values: any) => {
    try {
      await createDispatchTask({
        from_station_id: values.fromStation,
        to_station_id: values.toStation,
        bike_count: values.bikeCount,
        dispatch_vehicle_plate: values.vehiclePlate,
        scheduled_time: values.scheduledTime?.format('YYYY-MM-DD HH:mm:ss'),
        remark: values.remark,
      })
      message.success('调度任务创建成功')
      setModalVisible(false)
      form.resetFields()
      loadTasks()
    } catch (error) {
      console.error('创建调度任务失败:', error)
    }
  }

  const handleStartTask = async (id: number) => {
    try {
      await updateDispatchTaskStatus(id, '执行中')
      message.success('任务已开始执行')
      loadTasks()
    } catch (error) {
      console.error('开始任务失败:', error)
    }
  }

  const handleCompleteTask = async (id: number) => {
    try {
      await updateDispatchTaskStatus(id, '已完成')
      message.success('任务已完成')
      loadTasks()
    } catch (error) {
      console.error('完成任务失败:', error)
    }
  }

  const handleDeleteTask = async (id: number) => {
    try {
      await deleteDispatchTask(id)
      message.success('任务已删除')
      loadTasks()
    } catch (error) {
      console.error('删除任务失败:', error)
    }
  }

  const getStatusTag = (status: string) => {
    const colorMap: Record<string, string> = {
      '待执行': 'blue',
      '执行中': 'orange',
      '已完成': 'green',
      '已取消': 'gray',
    }
    return <Tag color={colorMap[status] || 'default'}>{status}</Tag>
  }

  const columns = [
    {
      title: '任务编号',
      dataIndex: 'taskCode',
      key: 'taskCode',
      width: 120,
    },
    {
      title: '调出站点',
      dataIndex: 'fromStationName',
      key: 'fromStationName',
      render: (text: string, record: DispatchTask) => (
        <span>
          {text}
          <Tag style={{ marginLeft: 4 }}>{record.fromDistrict}</Tag>
        </span>
      ),
    },
    {
      title: '调入站点',
      dataIndex: 'toStationName',
      key: 'toStationName',
      render: (text: string, record: DispatchTask) => (
        <span>
          {text}
          <Tag style={{ marginLeft: 4 }}>{record.toDistrict}</Tag>
        </span>
      ),
    },
    {
      title: '车辆数',
      dataIndex: 'bikeCount',
      key: 'bikeCount',
      width: 80,
      render: (count: number) => <span style={{ fontWeight: 600 }}>{count} 辆</span>,
    },
    {
      title: '调度车辆',
      dataIndex: 'dispatchVehiclePlate',
      key: 'dispatchVehiclePlate',
      width: 120,
    },
    {
      title: '计划时间',
      dataIndex: 'scheduledTime',
      key: 'scheduledTime',
      width: 160,
      render: (time: string) => time ? dayjs(time).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '调度员',
      dataIndex: 'dispatcherName',
      key: 'dispatcherName',
      width: 100,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: DispatchTask) => (
        <Space size="small">
          {record.status === '待执行' && (
            <Button
              type="link"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleStartTask(record.id)}
            >
              开始
            </Button>
          )}
          {record.status === '执行中' && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleCompleteTask(record.id)}
            >
              完成
            </Button>
          )}
          {record.status === '待执行' && (
            <Popconfirm
              title="确定删除此调度任务？"
              onConfirm={() => handleDeleteTask(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const statusFilters = [
    { text: '全部', value: undefined },
    { text: '待执行', value: '待执行' },
    { text: '执行中', value: '执行中' },
    { text: '已完成', value: '已完成' },
    { text: '已取消', value: '已取消' },
  ]

  return (
    <div>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0 }}>
            调度任务管理
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
            <Button icon={<ReloadOutlined />} onClick={loadTasks}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
              新建调度
            </Button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={tasks}
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
        title="新建调度任务"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            label="调出站点"
            name="fromStation"
            rules={[{ required: true, message: '请选择调出站点' }]}
          >
            <Select placeholder="请选择调出站点">
              {stations.map(s => (
                <Option key={s.id} value={s.id}>
                  {s.stationName} (可用 {s.availableBikes} 辆)
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="调入站点"
            name="toStation"
            rules={[{ required: true, message: '请选择调入站点' }]}
          >
            <Select placeholder="请选择调入站点">
              {stations.map(s => (
                <Option key={s.id} value={s.id}>
                  {s.stationName} (空桩 {s.emptyDocks} 个)
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="调度车辆数"
            name="bikeCount"
            rules={[{ required: true, message: '请输入调度车辆数' }]}
          >
            <InputNumber min={1} max={50} style={{ width: '100%' }} placeholder="请输入车辆数" />
          </Form.Item>

          <Form.Item label="调度车号牌" name="vehiclePlate">
            <Input placeholder="请输入调度车辆牌号" />
          </Form.Item>

          <Form.Item label="计划执行时间" name="scheduledTime">
            <DatePicker showTime style={{ width: '100%' }} placeholder="选择计划时间" />
          </Form.Item>

          <Form.Item label="备注" name="remark">
            <TextArea rows={3} placeholder="请输入备注信息" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                创建任务
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default DispatchTasks
