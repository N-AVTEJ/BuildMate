const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envLocalPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

async function testNativeFetch() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  const auth = Buffer.from(`${key_id}:${key_secret}`).toString('base64');

  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: 30000,
      currency: "INR",
      receipt: "TEST-NATIVE-FETCH-01",
      notes: { test: "native" },
    }),
  });

  const data = await res.json();
  console.log("Status:", res.status);
  console.log("Data:", data);
}

testNativeFetch();
