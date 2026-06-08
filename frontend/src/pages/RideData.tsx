import { useState, useEffect } from "react";
import {
  Row,
  Col,
  Card,
  Table,
  Statistic,
  Tag,
  DatePicker,
  Typography,
} from "antd";
import {
  ThunderboltOutlined,
  UserOutlined,
  CarOutlined,
} from "@ant-design/icons";
import ReactECharts from "echarts-for-react";
import { getRideRecords, RideRecord } from "@/api/ride";
import {
  getHourlyRides,
  getStationRideRank,
  HourlyRideData,
  StationRideRank,
  OverviewStats,
  getOverviewStats,
} from "@/api/stats";
import dayjs from "dayjs";

const { Title } = Typography;

const RideData = () => {
  const [records, setRecords] = useState<RideRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [hourlyData, setHourlyData] = useState<HourlyRideData[]>([]);
  const [borrowRank, setBorrowRank] = useState<StationRideRank[]>([]);
  const [returnRank, setReturnRank] = useState<StationRideRank[]>([]);
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [selectedDate, setSelectedDate] = useState(dayjs());

  const loadData = async () => {
    setLoading(true);
    try {
      const [recordsRes, hourlyRes, borrowRes, returnRes, overviewRes] =
        await Promise.all([
          getRideRecords({ page, pageSize }),
          getHourlyRides(selectedDate.format("YYYY-MM-DD")),
          getStationRideRank(10, "borrow"),
          getStationRideRank(10, "return"),
          getOverviewStats(),
        ]);
      setRecords(recordsRes.list);
      setTotal(recordsRes.total);
      setHourlyData(hourlyRes);
      setBorrowRank(borrowRes);
      setReturnRank(returnRes);
      setOverview(overviewRes);
    } catch (error) {
      console.error("加载骑行数据失败:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, pageSize, selectedDate]);

  const hourlyChartOption = {
    tooltip: {
      trigger: "axis",
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "3%",
      containLabel: true,
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: hourlyData.map((d) => d.hour),
    },
    yAxis: {
      type: "value",
      name: "骑行次数",
    },
    series: [
      {
        name: "骑行次数",
        type: "line",
        smooth: true,
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(22, 119, 255, 0.3)" },
              { offset: 1, color: "rgba(22, 119, 255, 0.05)" },
            ],
          },
        },
        lineStyle: {
          color: "#1677ff",
          width: 2,
        },
        itemStyle: {
          color: "#1677ff",
        },
        data: hourlyData.map((d) => d.count),
      },
    ],
  };

  const borrowRankChartOption = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "3%",
      containLabel: true,
    },
    xAxis: {
      type: "value",
      name: "借车次数",
    },
    yAxis: {
      type: "category",
      data: borrowRank.map((d) => d.stationName).reverse(),
    },
    series: [
      {
        name: "借车次数",
        type: "bar",
        data: borrowRank.map((d) => d.count).reverse(),
        itemStyle: {
          color: "#52c41a",
          borderRadius: [0, 4, 4, 0],
        },
      },
    ],
  };

  const returnRankChartOption = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "3%",
      containLabel: true,
    },
    xAxis: {
      type: "value",
      name: "还车次数",
    },
    yAxis: {
      type: "category",
      data: returnRank.map((d) => d.stationName).reverse(),
    },
    series: [
      {
        name: "还车次数",
        type: "bar",
        data: returnRank.map((d) => d.count).reverse(),
        itemStyle: {
          color: "#1677ff",
          borderRadius: [0, 4, 4, 0],
        },
      },
    ],
  };

  const columns = [
    {
      title: "骑行ID",
      dataIndex: "id",
      key: "id",
      width: 80,
    },
    {
      title: "车辆编号",
      dataIndex: "bikeCode",
      key: "bikeCode",
      width: 100,
    },
    {
      title: "用户手机",
      dataIndex: "userPhone",
      key: "userPhone",
      width: 120,
    },
    {
      title: "借车站点",
      dataIndex: "startStationName",
      key: "startStationName",
    },
    {
      title: "借车时间",
      dataIndex: "startTime",
      key: "startTime",
      width: 160,
      render: (time: string) => dayjs(time).format("YYYY-MM-DD HH:mm"),
    },
    {
      title: "还车站点",
      dataIndex: "endStationName",
      key: "endStationName",
      render: (text: string) => text || "-",
    },
    {
      title: "还车时间",
      dataIndex: "endTime",
      key: "endTime",
      width: 160,
      render: (time: string) =>
        time ? dayjs(time).format("YYYY-MM-DD HH:mm") : "-",
    },
    {
      title: "时长",
      dataIndex: "duration",
      key: "duration",
      width: 80,
      render: (min: number) => (min ? `${min}分钟` : "-"),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 80,
      render: (status: string) => (
        <Tag color={status === "已完成" ? "green" : "orange"}>{status}</Tag>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日骑行次数"
              value={overview?.todayRides.todayRides || 0}
              prefix={<ThunderboltOutlined style={{ color: "#1677ff" }} />}
              valueStyle={{ color: "#1677ff" }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日骑行人数"
              value={overview?.todayRides.todayUsers || 0}
              prefix={<UserOutlined style={{ color: "#52c41a" }} />}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="骑行中车辆"
              value={overview?.bikes.ridingBikes || 0}
              prefix={<CarOutlined style={{ color: "#fa8c16" }} />}
              valueStyle={{ color: "#fa8c16" }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日调度任务"
              value={overview?.todayDispatches.todayDispatches || 0}
              prefix={<CarOutlined style={{ color: "#722ed1" }} />}
              valueStyle={{ color: "#722ed1" }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <div className="chart-container">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <div className="chart-title">每小时骑行量趋势</div>
              <DatePicker
                value={selectedDate}
                onChange={(date) => date && setSelectedDate(date)}
              />
            </div>
            <ReactECharts option={hourlyChartOption} style={{ height: 300 }} />
          </div>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <div className="chart-container">
            <div className="chart-title">热门借车站点 TOP 10</div>
            <ReactECharts
              option={borrowRankChartOption}
              style={{ height: 320 }}
            />
          </div>
        </Col>
        <Col span={12}>
          <div className="chart-container">
            <div className="chart-title">热门还车站点 TOP 10</div>
            <ReactECharts
              option={returnRankChartOption}
              style={{ height: 320 }}
            />
          </div>
        </Col>
      </Row>

      <Card title="骑行记录">
        <Table
          columns={columns}
          dataSource={records}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
        />
      </Card>
    </div>
  );
};

export default RideData;
