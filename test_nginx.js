const http = require("http");

function makeRequest(method, path, data = null, token = null, port = 3000) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost",
      port: port,
      path: path,
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
    };
    if (token) {
      options.headers.Authorization = "Bearer " + token;
    }
    if (data) {
      options.headers["Content-Length"] = Buffer.byteLength(
        JSON.stringify(data),
      );
    }

    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on("error", reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function test() {
  console.log("=== 1. 测试登录 (通过后端9182端口) ===");
  const login = await makeRequest(
    "POST",
    "/api/auth/login",
    {
      username: "admin",
      password: "bike@2024",
    },
    null,
    9182,
  );
  console.log("状态:", login.status);
  const token = login.data.data?.token;
  console.log("Token:", token ? "获取成功" : "失败");

  if (!token) {
    console.log("登录失败，无法继续测试");
    return;
  }

  console.log("\n=== 2. 测试 GET /fault/reports (通过nginx 3000端口) ===");
  const getResult = await makeRequest(
    "GET",
    "/api/fault/reports?pageSize=3",
    null,
    token,
    3000,
  );
  console.log("状态:", getResult.status);
  console.log("返回:", JSON.stringify(getResult.data).substring(0, 300));

  console.log("\n=== 3. 测试 POST /fault/reports (通过后端9182端口) ===");
  const postResult1 = await makeRequest(
    "POST",
    "/api/fault/reports",
    {
      bike_code: "B00001",
      fault_type: "轮胎",
      description: "测试",
      reporter_phone: "13900139000",
    },
    token,
    9182,
  );
  console.log("状态:", postResult1.status);
  console.log("返回:", JSON.stringify(postResult1.data));

  console.log("\n=== 4. 测试 POST /fault/reports (通过nginx 3000端口) ===");
  const postResult2 = await makeRequest(
    "POST",
    "/api/fault/reports",
    {
      bike_code: "B00002",
      fault_type: "刹车",
      description: "测试",
      reporter_phone: "13900139000",
    },
    token,
    3000,
  );
  console.log("状态:", postResult2.status);
  console.log("返回:", JSON.stringify(postResult2.data));

  console.log("\n=== 测试完成 ===");
}

test().catch(console.error);
