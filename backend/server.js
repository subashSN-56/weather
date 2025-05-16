// backend/server.js
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const axios = require("axios");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cron = require("node-cron");
const twilio = require("twilio");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ Connected to MongoDB"))
.catch((err) => console.error("❌ MongoDB Error:", err));

// Mongoose model
const Alert = mongoose.model("Alert", {
  email: String,
  phone: String,
  city: String,
  threshold: Number,
  createdAt: { type: Date, default: Date.now },
});

// Email setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Twilio setup
const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);

// API endpoint to create alert
app.post("/weather/set-alert", async (req, res) => {
  const { email, phone, city, threshold } = req.body;
  const apiKey = process.env.WEATHER_API_KEY;

  try {
    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`
    );

    const temp = response.data.main.temp;
    await Alert.create({ email, phone, city, threshold });

    if (temp > parseFloat(threshold)) {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "🌡️ Weather Alert",
        text: `Current temperature in ${city} is ${temp}°C which is above your set threshold of ${threshold}°C.`,
      };

      await transporter.sendMail(mailOptions);

      await twilioClient.messages.create({
        body: `🌡️ Temp in ${city} is ${temp}°C! Above your ${threshold}°C alert.`,
        from: process.env.TWILIO_PHONE,
        to: phone,
      });

      return res.json({ message: `✅ Alert sent! Current temp is ${temp}°C.` });
    }

    return res.json({ message: `ℹ️ Temp is ${temp}°C. No alert triggered.` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "❌ Error fetching weather data." });
  }
});

// Cron job to check alerts every hour
cron.schedule("0 * * * *", async () => {
  console.log("⏰ Running hourly weather alert check...");
  const alerts = await Alert.find();

  for (let alert of alerts) {
    try {
      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?q=${alert.city}&appid=${process.env.WEATHER_API_KEY}&units=metric`
      );

      const temp = response.data.main.temp;

      if (temp > alert.threshold) {
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: alert.email,
          subject: "⏰ Scheduled Weather Alert",
          text: `Current temperature in ${alert.city} is ${temp}°C, above your ${alert.threshold}°C alert.`,
        };

        await transporter.sendMail(mailOptions);

        await twilioClient.messages.create({
          body: `⏰ ${alert.city} temp ${temp}°C > ${alert.threshold}°C!`,
          from: process.env.TWILIO_PHONE,
          to: alert.phone,
        });

        console.log(`✅ Alert sent to ${alert.email} and ${alert.phone}`);
      }
    } catch (err) {
      console.error(`❌ Error for alert ${alert.email}:`, err);
    }
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
