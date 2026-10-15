const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load .env.local
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envLocalPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

console.log("RAZORPAY_KEY_ID:", process.env.RAZORPAY_KEY_ID);
console.log("RAZORPAY_KEY_SECRET:", process.env.RAZORPAY_KEY_SECRET ? "[PRESENT]" : "[MISSING]");

const Razorpay = require('razorpay');
const rzp = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

async function testOrder() {
  try {
    const order = await rzp.orders.create({
      amount: 50000, // 500 INR in paise
      currency: "INR",
      receipt: "TEST-RECEIPT-01",
    });
    console.log("SUCCESS! Order created:", order);
  } catch (err) {
    console.error("FAILED! Razorpay error:", err);
  }
}

testOrder();
