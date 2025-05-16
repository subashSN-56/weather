document.getElementById("alertForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const city = document.getElementById("city").value;
  const threshold = document.getElementById("threshold").value;

  try {
    const res = await fetch("https://weather-backend-xrqm.onrender.com/weather/set-alert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, city, threshold }),
    });

    const data = await res.json();
    document.getElementById("message").innerText = data.message;
  } catch (error) {
    document.getElementById("message").innerText = "Error sending alert.";
  }
});

