import { useState, useEffect } from 'react'
import { Row, Col, Card, Typography, Select } from 'antd'
import ReactECharts from 'echarts-for-react'
import {
  getDistrictDailyRides,
  getStationFillRate,
  getDispatchCompletionRate,
  getFaultTypes,
  getDailyRides,
  DistrictDailyData,
  FillRateResult,
  DispatchCompletionData,
  FaultTypeData,
  DailyRideData,
} from '@/api/stats'
import dayjs from 'dayjs'

const { Title } = Typography
const { Option } = Select

const Statistics = () => {
  const [districtData, setDistrictData] = useState<DistrictDailyData[]>([])
  const [fillRateData, setFillRateData] = useState<FillRateResult | null>(null)
  const [completionData, setCompletionData] = useState<DispatchCompletionData[]>([])
  const [faultTypeData, setFaultTypeData] = useState<FaultTypeData[]>([])
  const [dailyRides, setDailyRides] = useState<DailyRideData[]>([])
  const [days, setDays] = useState(7)

  const loadData = async () => {
    try {
      const [districtRes, fillRateRes, completionRes, faultTypeRes, dailyRes] = await Promise.all([
        getDistrictDailyRides(days),
        getStationFillRate(),
        getDispatchCompletionRate(days),
        getFaultTypes(30),
        getDailyRides(days),
      ])
      setDistrictData(districtRes)
      setFillRateData(fillRateRes)
      setCompletionData(completionRes)
      setFaultTypeData(faultTypeRes)
      setDailyRides(dailyRes)
    } catch (error) {
      console.error('加载统计数据失败:', error)
    }
  }

  useEffect(() => {
    loadData()
  }, [days])

  const districtChartOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    legend: {
      data: ['东区', '西区', '南区'],
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: districtData.map(d => dayjs(d.date).format('MM-DD')),
    },
    yAxis: {
      type: 'value',
      name: '骑行量',
    },
    series: [
      {
        name: '东区',
        type: 'bar',
        data: districtData.map(d => d['东区'] || 0),
        itemStyle: { color: '#52c41a' },
      },
      {
        name: '西区',
        type: 'bar',
        data: districtData.map(d => d['西区'] || 0),
        itemStyle: { color: '#1677ff' },
      },
      {
        name: '南区',
        type: 'bar',
        data: districtData.map(d => d['南区'] || 0),
        itemStyle: { color: '#fa8c16' },
      },
    ],
  }

  const fillRateChartOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: fillRateData?.distribution.map(d => d.label) || [],
      axisLabel: { interval: 0, rotate: 0 },
    },
    yAxis: {
      type: 'value',
      name: '站点数量',
    },
    series: [
      {
        name: '站点数量',
        type: 'bar',
        data: fillRateData?.distribution.map((d, i) => ({
          value: d.count,
          itemStyle: {
            color: i <= 1 ? '#ff4d4f' : i <= 2 ? '#faad14' : i <= 4 ? '#52c41a' : '#ff4d4f',
            borderRadius: [4, 4, 0, 0],
          },
        })) || [],
        barWidth: '50%',
      },
    ],
  }

  const completionChartOption = {
    tooltip: {
      trigger: 'axis',
    },
    legend: {
      data: ['任务总数', '已完成', '完成率'],
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: completionData.map(d => dayjs(d.date).format('MM-DD')),
    },
    yAxis: [
      {
        type: 'value',
        name: '任务数',
      },
      {
        type: 'value',
        name: '完成率',
        min: 0,
        max: 100,
        axisLabel: { formatter: '{value}%' },
      },
    ],
    series: [
      {
        name: '任务总数',
        type: 'bar',
        data: completionData.map(d => d.total),
        itemStyle: { color: '#1677ff', borderRadius: [4, 4, 0, 0] },
      },
      {
        name: '已完成',
        type: 'bar',
        data: completionData.map(d => d.completed),
        itemStyle: { color: '#52c41a', borderRadius: [4, 4, 0, 0] },
      },
      {
        name: '完成率',
        type: 'line',
        yAxisIndex: 1,
        data: completionData.map(d => parseFloat(d.rate)),
        smooth: true,
        itemStyle: { color: '#fa8c16' },
        lineStyle: { width: 2 },
      },
    ],
  }

  const faultTypeChartOption = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      left: 'left',
    },
    series: [
      {
        name: '故障类型',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['60%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: true,
          formatter: '{b}\n{d}%',
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: 'bold',
          },
        },
        data: faultTypeData.map(d => ({
          value: d.count,
          name: d.fault_type,
        })),
        color: ['#ff4d4f', '#fa8c16', '#1677ff', '#722ed1', '#52c41a', '#8c8c8c'],
      },
    ],
  }

  const dailyRidesChartOption = {
    tooltip: {
      trigger: 'axis',
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dailyRides.map(d => dayjs(d.date).format('MM-DD')),
    },
    yAxis: {
      type: 'value',
      name: '骑行次数',
    },
    series: [
      {
        name: '日均骑行量',
        type: 'line',
        smooth: true,
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(82, 196, 26, 0.3)' },
              { offset: 1, color: 'rgba(82, 196, 26, 0.05)' },
            ],
          },
        },
        lineStyle: {
          color: '#52c41a',
          width: 2,
        },
        itemStyle: {
          color: '#52c41a',
        },
        data: dailyRides.map(d => d.count),
      },
    ],
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          统计分析
        </Title>
        <Select value={days} onChange={setDays} style={{ width: 150 }}>
          <Option value={7}>最近7天</Option>
          <Option value={14}>最近14天</Option>
          <Option value={30}>最近30天</Option>
        </Select>
      </div>

      <Row gutter={[16, 16]}>
        <Col span={12}>
          <div className="chart-container">
            <div className="chart-title">各片区日均骑行量</div>
            <ReactECharts option={districtChartOption} style={{ height: 320 }} />
          </div>
        </Col>

        <Col span={12}>
          <div className="chart-container">
            <div className="chart-title">站点满载率分布直方图</div>
            <ReactECharts option={fillRateChartOption} style={{ height: 320 }} />
          </div>
        </Col>

        <Col span={12}>
          <div className="chart-container">
            <div className="chart-title">调度任务完成率趋势</div>
            <ReactECharts option={completionChartOption} style={{ height: 320 }} />
          </div>
        </Col>

        <Col span={12}>
          <div className="chart-container">
            <div className="chart-title">车辆故障类型分布 (近30天)</div>
            <ReactECharts option={faultTypeChartOption} style={{ height: 320 }} />
          </div>
        </Col>

        <Col span={24}>
          <div className="chart-container">
            <div className="chart-title">近{days}天骑行量趋势</div>
            <ReactECharts option={dailyRidesChartOption} style={{ height: 300 }} />
          </div>
        </Col>
      </Row>
    </div>
  )
}

export default Statistics
