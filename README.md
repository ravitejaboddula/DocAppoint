# 🏥 DocAppoint — Smart Hospital Appointment Booking System

> A full-stack hospital appointment booking platform with AI-powered triage, real-time booking management, and a hospital admin dashboard.

---

## 🌟 Features

### 👤 User Side
- **User Registration & Login** — Secure JWT-based authentication with password visibility toggle
- **Browse Nearby Hospitals** — Location-aware hospital listing with distance calculation
- **Search & Filter** — Filter hospitals by category (Cardiology, Multi-specialty, Ortho/Neuro, Government) and sort by distance or available slots
- **Doctor Browsing** — View doctor names, specializations, and real-time availability schedules
- **Appointment Booking** — Book appointments with specific doctors on available dates & time slots
- **AI Chatbot Triage** — Intelligent symptom checker powered by **Google Gemini 2.5 Flash**

### 🏨 Hospital Admin Side
- **Secure Hospital Login** — JWT-protected admin portal per hospital
- **Hospital Dashboard** — View all doctors and their bookings for Today / Tomorrow
- **Booking Management** — Mark bookings as Completed ✅ or Cancel ❌ (deletes from database with animation)
- **Edit Doctors Modal** — View all doctors in a clean modal with individual Edit (schedule) and Remove options
- **Add New Doctor** — Expandable form with name, specialization, and day-picker schedule
- **Availability Scheduling** — Set which days each doctor is available (persisted to MongoDB)

### 🤖 AI Chatbot
- Symptom-based specialist recommendation using **Google Gemini 2.5 Flash**
- 15-category local fallback triage if AI is unavailable
- Auto-links to relevant hospitals/doctors based on chat recommendations

---

## 🏗️ Architecture

```
DocAppoint/
├── src/                          # React Frontend (Vite)
│   ├── App.jsx                   # Main application (Auth, Booking, Dashboard)
│   └── components/
│       └── ChatbotWidget.jsx     # AI Chatbot UI component
│
├── hospital-service/             # Java Spring Boot Backend
│   └── src/main/java/com/docappoint/hospitalservice/
│       ├── controller/           # REST API Controllers
│       │   ├── AuthController.java       # User & Hospital login/register
│       │   ├── BookingController.java    # CRUD for bookings
│       │   ├── HospitalController.java   # Hospital data & doctor availability
│       │   └── HealthController.java     # /actuator/health
│       ├── model/                # MongoDB Document Models
│       │   ├── User.java
│       │   ├── Hospital.java
│       │   ├── Doctor.java
│       │   ├── Booking.java
│       │   └── HospitalAdmin.java
│       ├── repository/           # Spring Data MongoDB Repositories
│       ├── security/             # JWT Filter, JWT Util, Security Config
│       ├── service/              # DataSeederService (seeds on first run only)
│       └── config/               # HospitalDataSeeder, HospitalAdminSeeder
│
└── chatbot-service/              # Java Spring Boot Chatbot Microservice
    └── Integrates with Google Gemini 2.5 Flash API
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, Vanilla CSS, Tailwind-inspired utility classes |
| **Backend** | Java 17, Spring Boot 3.2, Spring Security, JWT |
| **Database** | MongoDB Atlas (cloud) |
| **AI** | Google Gemini 2.5 Flash API |
| **Auth** | JWT (JSON Web Tokens) + BCrypt password hashing |
| **Build** | Maven (backend), npm/Vite (frontend) |

---

## 🚀 Getting Started

### Prerequisites
- **Java 17+** — [Download](https://adoptium.net/)
- **Node.js 18+** — [Download](https://nodejs.org/)
- **Maven 3.8+** — [Download](https://maven.apache.org/)
- **MongoDB Atlas** account — [cloud.mongodb.com](https://cloud.mongodb.com)

### 1. Clone the repository
```bash
git clone https://github.com/ravitejaboddula/DocAppoint.git
cd DocAppoint
```

### 2. Configure the Backend

Copy the template and fill in your Atlas credentials:
```bash
cp hospital-service/src/main/resources/application.properties.template \
   hospital-service/src/main/resources/application.properties
```

Edit `application.properties`:
```properties
spring.application.name=hospital-service
server.port=5000
spring.data.mongodb.uri=mongodb+srv://<USERNAME>:<PASSWORD>@<CLUSTER>.mongodb.net/docappoint?appName=docappoint
```

### 3. Start the Hospital Service Backend
```bash
cd hospital-service
mvn spring-boot:run
```
> Runs on **http://localhost:5000**  
> Seeds 130 hospitals + 10 admin accounts on first run automatically.

### 4. Start the Chatbot Service (optional)
```bash
cd chatbot-service
mvn spring-boot:run
```

### 5. Start the Frontend
```bash
# From the root DocAppoint folder
npm install
npm run dev
```
> Opens at **http://localhost:5173**

---

## 🔑 Default Credentials

### Hospital Admin Login
| Hospital ID | Password |
|---|---|
| 1001 – 1010 | `hospital@123` |

> Hospital IDs 1001–1010 correspond to hospitals in the **Pocharam Jodimetla** area.

### User Login
Register a new account from the login screen.

---

## 📡 API Endpoints

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | User login → returns JWT |
| POST | `/api/auth/hospital-login` | Hospital admin login → returns JWT |

### Hospitals
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/hospitals` | Get all hospitals |
| PATCH | `/api/hospitals/{id}/doctors/{index}/availability` | Update doctor availability |

### Bookings
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/bookings` | Create a new booking |
| GET | `/api/bookings/hospital/{hospitalId}` | Get bookings for a hospital |
| PATCH | `/api/bookings/{id}/status` | Update booking status |
| DELETE | `/api/bookings/{id}` | Delete a booking |

---

## ☁️ Deployment

### Frontend → Vercel
```bash
npm run build
# Deploy the dist/ folder to Vercel
```

### Backend → Render / Railway
- Push to GitHub ✅  
- Connect your repo on [render.com](https://render.com) or [railway.app](https://railway.app)  
- Set environment variable: `SPRING_DATA_MONGODB_URI=mongodb+srv://...`  
- Build command: `mvn -f hospital-service/pom.xml clean package -DskipTests`  
- Start command: `java -jar hospital-service/target/*.jar`

---

## 🔒 Security Notes
- Passwords are **BCrypt hashed** in the database
- All protected routes use **JWT Bearer tokens**
- `application.properties` is excluded from git (contains secrets)
- Use `application.properties.template` as a guide

---

## 📸 Screenshots

| User Dashboard | Hospital Dashboard | AI Chatbot |
|---|---|---|
| Browse hospitals, book appointments | Manage doctors & bookings | Symptom-based specialist finder |

---

## 🙋 Author

**Raviteja Boddula**  
GitHub: [@ravitejaboddula](https://github.com/ravitejaboddula)

---

## 📄 License

This project is for educational purposes.
