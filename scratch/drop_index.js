const { createClient } = require("@libsql/client");
const path = require("path");

const dbPath = "file:" + path.join(__dirname, "../school.db");
console.log("Connecting to:", dbPath);

const client = createClient({ url: dbPath });

async function run() {
  try {
    await client.execute("DROP INDEX IF EXISTS attendance_student_class_date_idx;");
    console.log("Successfully dropped index attendance_student_class_date_idx");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    client.close();
  }
}

run();
