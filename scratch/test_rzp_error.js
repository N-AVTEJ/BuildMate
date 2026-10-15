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

const Razorpay = require('razorpay');
const rzp = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

async function testBadOrder() {
  try {
    // Bad amount < 100 paise
    await rzp.orders.create({
      amount: 50,
      currency: "INR",
      receipt: "TEST",
    });
  } catch (err) {
    console.log("Error object keys:", Object.keys(err));
    console.log("Error statusCode:", err.statusCode);
    console.log("Error error field:", err.error);
    console.log("JSON:", JSON.stringify(err, null, 2));
  }
}

testBadOrder();
