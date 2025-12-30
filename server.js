Const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/subjects", require("./routes/subject.routes"));
app.use("/api/lectures", require("./routes/lecture.routes"));
app.use("/api/notifications", require("./routes/notification.routes"))
app.use("/api/attendance", require("./routes/attendance.routes"));
app.use("/api/references", require("./routes/reference.routes"));

mongoose.connect(process.env.MONGO_URI)
.then(()=>console.log("DB Connected"))
.catch(err=>console.log(err));

app.listen(5000, ()=> {
  console.log("Server running on port 5000");
});
