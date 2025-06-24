 GenzTalks - Real-Time Chat Web Application

GenzTalks is a full-stack, real-time chat application designed for seamless one-on-one and group messaging. Built using the MERN stack and Socket.IO, it features secure authentication, real-time messaging, online user status, and a modern, Gen Z–friendly UI.


Features

- User Authentication – Register/Login system secured with JWT and password hashing (bcrypt).
- Real-Time Chat – One-on-one and group chats powered by Socket.IO.
- Typing Indicator – See when the other user is typing.
- Online Presence – Displays online/offline status of users.
- Clean UI – Gen Z-inspired design using React and Tailwind CSS.
- Group Chats – Create and manage group conversations.


Tech Stack

- Frontend: React.js, Tailwind CSS  
- Backend: Node.js, Express.js  
- Database: MongoDB (via Mongoose)  
- Authentication: JWT (JSON Web Tokens)  
- Real-Time Messaging: Socket.IO  
- Other Tools: bcryptjs, dotenv

Project Structure

 Backend (Node + Express)
- `models/User.js` – Mongoose schema for users
- `models/Message.js` – Mongoose schema for messages
- `middleware/auth.js` – JWT middleware
- `index.js` – Entry point, includes Socket.IO setup

 Frontend (React)
- Components for:
  - Chat threads
  - User list
  - Chat input
- Tailwind-styled layout with pastel themes

How to Run Locally

Clone the repository:
   ```bash
   git clone https://github.com/yourusername/genztalks.git
   cd genztalks
