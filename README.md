        <div align="center">

        # 🚀 MockMate

        **AI-Powered Mock Interview Platform for Placement Preparation**

        [![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://mockmate-wheat.vercel.app)
        [![License](https://img.shields.io/badge/license-MIT-blue)](#)
        [![Made with React](https://img.shields.io/badge/frontend-React-61DAFB)](#)
        [![Made with Node](https://img.shields.io/badge/backend-Node.js-339933)](#)

        [Live Demo](https://mockmate-wheat.vercel.app) · [Features](#-features) · [Tech Stack](#-tech-stack) · [Installation](#️-installation) · [API Overview](#-api-overview)

        </div>

        ---

        ## 📖 About

        **MockMate** is a full-stack, AI-powered mock interview platform built to help students prepare for technical placements through structured, company-specific mock interviews. Unlike a generic AI chatbot, MockMate runs **timed interview sessions**, tracks progress over time, stores interview history, and generates **detailed AI-powered feedback** so users can improve consistently, session after session.

        ---

        ## ✨ Features

        | | |
        |---|---|
        | 🔐 | JWT Authentication & Authorization |
        | 👤 | Student & Admin Roles |
        | 🏢 | Company-Specific Interviews |
        | 💻 | Multiple Interview Categories (DSA, HR, Core CS) |
        | ⏱️ | Real-Time Interview Timer |
        | 📝 | Automatic Answer Saving |
        | 🤖 | AI-Powered Answer Evaluation using OpenRouter |
        | 📊 | Performance Analytics Dashboard |
        | 🏆 | Leaderboard |
        | 📈 | Progress Tracking |
        | 📋 | Detailed Interview Reports |
        | 📱 | Responsive UI |

        ---

        ## 🛠 Tech Stack

        **Frontend**
        - React.js
        - Vite
        - Tailwind CSS
        - React Router
        - Axios
        - Recharts

        **Backend**
        - Node.js
        - Express.js
        - MongoDB
        - Mongoose
        - JWT Authentication
        - bcrypt
        - OpenRouter API

        ---

        ## 🏗 Architecture

        ```
        React Frontend
                │
                ▼
        Axios API Calls
                │
                ▼
        Express REST API
                │
        ┌──────┴─────────┐
        │                │
        ▼                ▼
        MongoDB      OpenRouter AI
                │
                ▼
        Interview Report
        ```

        ---

        ## 📂 Project Structure

        ```
        mockmate/
        ├── client/          # React frontend
        ├── server/          # Express backend
        └── README.md
        ```

        ---

        ## 🔄 Request Flow

        ```
        User → React Frontend → Axios → Express Routes → Controllers
        → MongoDB → OpenRouter AI Evaluation → MongoDB → Response to Frontend
        ```

        ---

        ## 🤖 AI Evaluation

        MockMate uses **OpenRouter** to evaluate interview answers.

        For every submitted answer, the backend sends:

        - Interview Question
        - Expected Key Points
        - Student's Answer

        The AI returns:

        - ⭐ Score
        - ✅ Positive Points
        - ❌ Missing Concepts
        - 💡 Improvement Tip
        - 📖 Model Answer

        The backend validates the AI response before saving it to MongoDB, ensuring structured feedback even if the AI provider changes.

        ---

        ## 🔐 Authentication

        - JWT Authentication
        - Protected Routes
        - Role-Based Authorization
        - Password Hashing using bcrypt

        ---

        ## 📊 Dashboard

        Students can view:

        - Total Interviews
        - Average Score
        - Best Company Performance
        - Score Trend
        - Weak Topics
        - Interview History

        ---

        ## 🗄 Database Collections

        - Users
        - Questions
        - Sessions
        - Feedback
        - Leaderboard

        ---

        ## ⚙️ Installation

        ### 1. Clone the Repository

        ```bash
        git clone https://github.com/ram3124/mockmate.git
        cd mockmate
        ```

        ### 2. Install Dependencies

        **Client**
        ```bash
        cd client
        npm install
        ```

        **Server**
        ```bash
        cd server
        npm install
        ```

        ---

        ## 🔑 Environment Variables

        **Backend (`server/.env`)**
        ```env
        PORT=5000
        MONGO_URI=your_mongodb_uri
        JWT_SECRET=your_secret
        OPENROUTER_API_KEY=your_api_key
        CLIENT_URL=http://localhost:5173
        ```

        **Frontend (`client/.env`)**
        ```env
        VITE_API_URL=http://localhost:5000/api
        ```

        ---

        ## ▶️ Run Locally

        **Backend**
        ```bash
        cd server
        npm run dev
        ```

        **Frontend**
        ```bash
        cd client
        npm run dev
        ```

        ---

        ## 📌 API Overview

        | Method | Endpoint | Description |
        |--------|----------|-------------|
        | POST | `/auth/register` | Register User |
        | POST | `/auth/login` | Login |
        | GET | `/questions` | Get Questions |
        | POST | `/sessions/start` | Start Interview |
        | POST | `/sessions/:id/answer` | Submit Answer |
        | POST | `/sessions/:id/complete` | Complete Interview |
        | GET | `/sessions/:id/report` | Get Report |
        | GET | `/analytics/dashboard` | Dashboard Stats |
        | GET | `/leaderboard` | Leaderboard |

        ---

        ## 🚀 Future Improvements

        - [ ] Voice-based interviews
        - [ ] Speech-to-Text
        - [ ] PDF Report Export
        - [ ] Mobile Application
        - [ ] Email Progress Reports
        - [ ] Peer Mock Interviews

        ---

        ## 👨‍💻 Author

        **Ram Bhamoriya**
        GitHub: [@ram3124](https://github.com/ram3124)

        ---

        ## ⭐ Support

        If you find this project useful, consider giving it a ⭐ on GitHub — it helps a lot!
