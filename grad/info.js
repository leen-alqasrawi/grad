document.addEventListener("DOMContentLoaded", async function () {
  const params = new URLSearchParams(window.location.search);
  const schoolName = params.get("school");
  if (!schoolName) return;

  try {
    const response = await fetch(`http://localhost:5000/school-info?name=${encodeURIComponent(schoolName)}`);
    if (!response.ok) throw new Error('Failed to load school data');

    const data = await response.json();

    // Update the title
    const titleElement = document.getElementById("schoolTitle");
    if (titleElement) {
      titleElement.textContent = data["اسم المدرسة"] || "معلومات المدرسة";
    }

    // General school info
    document.getElementById("system").textContent = data["نظام التعليمي"] || '—';
    document.getElementById("special_needs").textContent = data["تقبل الطلبة من ذوي الإحتياجات"] || '—';
    document.getElementById("language").textContent = data["لغة التدريس"] || '—';
    document.getElementById("mixed").textContent = data["مختلطة"] || '—';
    document.getElementById("max_grade").textContent = data["اعلى صف"] || '—';

    // Tuition prices by grade
    const gradeFields = {
      "براعم": "الروضة | براعم",
      "بستان": "الروضة | بستان",
      "تمهيدي": "الروضة | تمهيدي",
      "الاول": "الصف الاول",
      "الثاني": "الصف الثاني",
      "الثالث": "الصف الثالث",
      "الرابع": "الصف الرابع",
      "الخامس": "الصف الخامس",
      "السادس": "الصف السادس",
      "السابع": "الصف السابع",
      "الثامن": "الصف الثامن",
      "التاسع": "الصف التاسع",
      "العاشر": "الصف العاشر",
      "الاول ثانوي": "الصف الأول ثانوي",
      "الثاني ثانوي": "الصف الثاني ثانوي"
    };

    Object.entries(gradeFields).forEach(([id, dbKey]) => {
      const cell = document.getElementById(id);
      if (cell) {
        const value = data[dbKey];
        cell.textContent = value !== null && value !== undefined ? `${value} د.أ` : '—';
      }
    });

  } catch (error) {
    console.error("Error loading school info:", error);
    alert("فشل تحميل معلومات المدرسة. حاول مرة أخرى.");
  }
});