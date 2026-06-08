import { useState, useEffect } from "react";
import {
  Row,
  Col,
  Card,
  Tabs,
  Tag,
  Statistic,
  Space,
  Button,
  Badge,
  Typography,
} from "antd";
import {
  ThunderboltOutlined,
  CarOutlined,
  WarningOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  getStationList,
  getDispatchSuggestions,
  Station,
  DispatchSuggestionsResult,
} from "@/api/stations";
import { getOverviewStats, OverviewStats } from "@/api/stats";
import { useAuthStore } from "@/store/auth";
import dayjs from "dayjs";

const { Title } = Typography;

interface StationCardProps {
  station: Station;
}

const StationCard = ({ station }: StationCardProps) => {
  const fillRate = parseFloat(station.fillRate || "0");
  const statusColor =
    station.statusLevel === "surplus"
      ? "red"
      : station.statusLevel === "shortage"
        ? "gold"
        : "green";
  const statusText =
    station.statusLevel === "surplus"
      ? "车辆过剩"
      : station.statusLevel === "shortage"
        ? "车辆不足"
        : "正常";

  const docks = Array.from(
    { length: station.totalDocks },
    (_, i) => i < station.availableBikes,
  );

  return (
    <Card
      className="station-card"
      size="small"
      title={
        <Space>
          <span>{station.stationName}</span>
          <Tag color={statusColor}>{statusText}</Tag>
        </Space>
      }
      extra={
        <span style={{ fontSize: 12, color: "#999" }}>
          {station.stationCode}
        </span>
      }
    >
      <div style={{ marginBottom: 8 }}>
        <div className="dock-progress">
          <div
            className="dock-filled"
            style={{
              width: `${fillRate}%`,
              backgroundColor:
                station.statusLevel === "surplus"
                  ? "#ff4d4f"
                  : station.statusLevel === "shortage"
                    ? "#faad14"
                    : "#52c41a",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
            color: "#666",
          }}
        >
          <span>可用: {station.availableBikes}</span>
          <span style={{ fontWeight: 600, color: statusColor }}>
            {fillRate.toFixed(1)}%
          </span>
          <span>空桩: {station.emptyDocks}</span>
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
        {docks.slice(0, 40).map((filled, i) => (
          <div
            key={i}
            style={{
              width: 6,
              height: 10,
              borderRadius: 1,
              backgroundColor: filled ? "#1677ff" : "#e5e7eb",
            }}
          />
        ))}
        {station.totalDocks > 40 && (
          <span style={{ fontSize: 10, color: "#999" }}>...</span>
        )}
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: "#999" }}>
        共 {station.totalDocks} 个桩位 · {station.district}
      </div>
    </Card>
  );
};

const StationOverview = () => {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [suggestions, setSuggestions] =
    useState<DispatchSuggestionsResult | null>(null);
  const { userInfo } = useAuthStore();

  const districts = ["all", "东区", "西区", "南区"];

  const loadData = async () => {
    setLoading(true);
    try {
      const [stationRes, overviewRes, suggestionRes] = await Promise.all([
        getStationList({ pageSize: 100 }),
        getOverviewStats(),
        getDispatchSuggestions(),
      ]);
      setStations(stationRes.list);
      setOverview(overviewRes);
      setSuggestions(suggestionRes);
    } catch (error) {
      console.error("加载数据失败:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredStations =
    activeTab === "all"
      ? stations
      : stations.filter((s) => s.district === activeTab);

  const tabItems = [
    { key: "all", label: "全部站点" },
    ...(userInfo?.role === "admin"
      ? districts.slice(1).map((d) => ({ key: d, label: d }))
      : []),
  ];

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="站点总数"
              value={overview?.stations.totalStations || 0}
              prefix={<CarOutlined style={{ color: "#1677ff" }} />}
              valueStyle={{ color: "#1677ff" }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="车辆总数"
              value={overview?.bikes.totalBikes || 0}
              prefix={<ThunderboltOutlined style={{ color: "#52c41a" }} />}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日骑行"
              value={overview?.todayRides.todayRides || 0}
              prefix={<ThunderboltOutlined style={{ color: "#fa8c16" }} />}
              valueStyle={{ color: "#fa8c16" }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="需调度站点"
              value={suggestions?.totalNeedDispatch || 0}
              prefix={<WarningOutlined style={{ color: "#ff4d4f" }} />}
              valueStyle={{ color: "#ff4d4f" }}
            />
          </Card>
        </Col>
      </Row>

      {suggestions && suggestions.totalNeedDispatch > 0 && (
        <Card style={{ marginBottom: 24 }}>
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            {suggestions.surplusStations.length > 0 && (
              <div>
                <Title level={5} style={{ color: "#ff4d4f", marginBottom: 8 }}>
                  <WarningOutlined /> 车辆过剩需调出
                </Title>
                <Space wrap>
                  {suggestions.surplusStations.map((s) => (
                    <Tag key={s.id} color="red" style={{ padding: "4px 8px" }}>
                      {s.stationName} (需调出 {s.adjustCount} 辆)
                    </Tag>
                  ))}
                </Space>
              </div>
            )}
            {suggestions.shortageStations.length > 0 && (
              <div>
                <Title level={5} style={{ color: "#faad14", marginBottom: 8 }}>
                  <WarningOutlined /> 车辆不足需调入
                </Title>
                <Space wrap>
                  {suggestions.shortageStations.map((s) => (
                    <Tag key={s.id} color="gold" style={{ padding: "4px 8px" }}>
                      {s.stationName} (需调入 {s.adjustCount} 辆)
                    </Tag>
                  ))}
                </Space>
              </div>
            )}
          </Space>
        </Card>
      )}

      <Card
        title="站点列表"
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={loadData}
            loading={loading}
          >
            刷新
          </Button>
        }
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          style={{ marginBottom: 16 }}
        />

        <Row gutter={[16, 16]}>
          {filteredStations.map((station) => (
            <Col xs={24} sm={12} md={8} lg={6} key={station.id}>
              <StationCard station={station} />
            </Col>
          ))}
        </Row>

        {filteredStations.length === 0 && !loading && (
          <div style={{ textAlign: "center", padding: 40, color: "#999" }}>
            暂无站点数据
          </div>
        )}
      </Card>
    </div>
  );
};

export default StationOverview;
