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

async function testProjectOrder() {
  const amountInPaise = 300 * 100;
  const cleanReceipt = 'PRJ-2026-0180-ADVANCE'.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
  console.log("cleanReceipt:", cleanReceipt);
  console.log("amountInPaise:", amountInPaise);

  try {
    const order = await rzp.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: cleanReceipt,
      notes: {
        projectId: '78d9cffa-bad2-4e67-8b37-a393718f2612',
        projectCode: 'PRJ-2026-0180',
        paymentType: 'ADVANCE',
        clientId: '771d1521-a237-449c-9665-fbe90ed30f4e',
      },
    });
    console.log("Order created successfully:", order);
  } catch (err) {
    console.error("Order creation failed:", err);
  }
}

testProjectOrder();
