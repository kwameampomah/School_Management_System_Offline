const fs = require('fs');

async function runVerification() {
  console.log("=== STARTING TAIFA GES REPORT SYSTEM VERIFICATION ===");
  const baseUrl = "http://localhost:8085/api";

  try {
    // 1. Authenticate (Login)
    console.log("\n[1] Attempting authentication with admin account...");
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: "admin@school.gh",
        password: "admin123"
      })
    });

    if (!loginRes.ok) {
      const errorText = await loginRes.text();
      throw new Error(`Login failed with status ${loginRes.status}: ${errorText}`);
    }

    const loginData = await loginRes.json();
    console.log(`✅ Login successful! Logged in as: ${loginData.fullName} (${loginData.role})`);

    // Capture Session Cookie
    const cookieHeader = loginRes.headers.get("set-cookie");
    if (!cookieHeader) {
      throw new Error("No session cookie set on login response!");
    }
    const sessionCookie = cookieHeader.split(";")[0];
    console.log(`✅ Captured Session Cookie: ${sessionCookie.substring(0, 20)}...`);

    // 2. Fetch authenticated profile /auth/me
    console.log("\n[2] Verifying session validity via /auth/me...");
    const profileRes = await fetch(`${baseUrl}/auth/me`, {
      headers: {
        "Cookie": sessionCookie
      }
    });

    if (!profileRes.ok) {
      throw new Error(`Profile check failed with status ${profileRes.status}`);
    }
    const profileData = await profileRes.json();
    console.log(`✅ Session verified successfully. Returned user: ${profileData.fullName}`);

    // 3. Fetch academic terms to get a valid term ID
    console.log("\n[3] Fetching active academic terms...");
    const termsRes = await fetch(`${baseUrl}/terms`, {
      headers: {
        "Cookie": sessionCookie
      }
    });

    if (!termsRes.ok) {
      throw new Error(`Terms fetch failed with status ${termsRes.status}`);
    }
    const terms = await termsRes.json();
    if (!terms || terms.length === 0) {
      throw new Error("No academic terms found in the database. Ensure db is seeded.");
    }
    const targetTerm = terms[0];
    console.log(`✅ Found Term: ${targetTerm.name} (ID: ${targetTerm.id})`);

    // 4. Fetch students list to get a valid student ID
    console.log("\n[4] Fetching student directory...");
    const studentsRes = await fetch(`${baseUrl}/students`, {
      headers: {
        "Cookie": sessionCookie
      }
    });

    if (!studentsRes.ok) {
      throw new Error(`Students directory fetch failed with status ${studentsRes.status}`);
    }
    const students = await studentsRes.json();
    if (!students || students.length === 0) {
      throw new Error("No students found in the database.");
    }
    const targetStudent = students[0];
    console.log(`✅ Found Student: ${targetStudent.fullName} (ID: ${targetStudent.id})`);

    // 5. Test PDF Generation and Export
    console.log(`\n[5] Testing PDF generation & export for student ID: ${targetStudent.id}, term ID: ${targetTerm.id}...`);
    const pdfRes = await fetch(`${baseUrl}/report-cards/${targetStudent.id}/${targetTerm.id}/export`, {
      headers: {
        "Cookie": sessionCookie
      }
    });

    if (!pdfRes.ok) {
      const errorText = await pdfRes.text();
      throw new Error(`PDF export failed with status ${pdfRes.status}: ${errorText}`);
    }

    const contentType = pdfRes.headers.get("content-type");
    const contentDisposition = pdfRes.headers.get("content-disposition");
    console.log(`✅ Content-Type returned: ${contentType}`);
    console.log(`✅ Content-Disposition returned: ${contentDisposition}`);

    if (contentType !== "application/pdf") {
      throw new Error(`Expected content type 'application/pdf', got '${contentType}'`);
    }

    const arrayBuffer = await pdfRes.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);
    
    // Check for PDF signature (%PDF-)
    const pdfStringHeader = pdfBuffer.toString('utf8', 0, 5);
    console.log(`✅ Checking file signature: ${pdfStringHeader}`);
    if (pdfStringHeader !== "%PDF-") {
      throw new Error(`Invalid PDF file signature! Got: ${pdfStringHeader}`);
    }
    console.log(`✅ Generated PDF file size: ${pdfBuffer.length} bytes`);

    console.log("\n=== 🎉 ALL SYSTEM A BACKEND & DB VERIFICATION CHECKS PASSED SUCCESSFULLY! ===");
  } catch (error) {
    console.error("\n❌ VERIFICATION FAILED:");
    console.error(error.message || error);
    process.exit(1);
  }
}

runVerification();
