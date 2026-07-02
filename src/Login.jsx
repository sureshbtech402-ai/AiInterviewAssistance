import bg from "./assets/login-bg.png";
import "./styles/login.css";
import { useState } from "react";

import { auth, googleProvider } from "./firebase";

import {
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    signInWithPopup,
    signOut
} from "firebase/auth";

function Login({ setUser }) {

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const allowedEmails = [
        "sureshbtech402@gmail.com",
        "gollapruthvi@gmail.com",
        "sureshchinnamadula768@gmail.com"
    ];

    const isAllowedUser = (userEmail) => {
        return allowedEmails.includes(userEmail?.toLowerCase());
    };

    const handleLogin = async () => {

        if (!email.trim()) {
            alert("Please enter your Email.");
            return;
        }

        if (!password.trim()) {
            alert("Please enter your Password.");
            return;
        }

        try {

            const userCredential = await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

            const loggedInEmail = userCredential.user.email?.toLowerCase();

            if (!isAllowedUser(loggedInEmail)) {
                await signOut(auth);
                alert("Access denied. You are not allowed to use this application.");
                return;
            }

            alert("✅ Login Successful");
            setUser(userCredential.user);

        } catch (error) {
            alert("Invalid Email or Password.");
        }
    };

    const handleGoogleLogin = async () => {

        try {

            const result = await signInWithPopup(
                auth,
                googleProvider
            );

            const loggedInEmail = result.user.email?.toLowerCase();

            if (!isAllowedUser(loggedInEmail)) {
                await signOut(auth);
                alert("Access denied. You are not allowed to use this application.");
                return;
            }

            alert("✅ Google Login Successful");
            setUser(result.user);

        } catch (error) {
            console.error("Google Login Error:", error);
            alert(error.message);
        }
    };

    const handleForgotPassword = async () => {

        if (!email.trim()) {
            alert("Please enter your Email first.");
            return;
        }

        try {
            await sendPasswordResetEmail(auth, email);
            alert("✅ Password Reset Email Sent.");
        } catch (error) {
            alert(error.message);
        }
    };

    return (
        <div
            className="login-page"
            style={{
                backgroundImage: `url(${bg})`
            }}
        >
            <div className="login-card">

                <h1 className="login-title">
                    AI Interview Assistant
                </h1>

                <p className="login-subtitle">
                    Smart AI Powered Interview Preparation
                </p>

                <input
                    type="email"
                    placeholder="Enter Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />

                <input
                    type="password"
                    placeholder="Enter Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />

                <div
                    style={{
                        textAlign: "right",
                        marginBottom: "20px",
                        color: "#8b5cf6",
                        cursor: "pointer",
                        fontWeight: "600",
                        fontSize: "15px"
                    }}
                    onClick={handleForgotPassword}
                >
                    Forgot Password?
                </div>

                <button
                    className="login-btn"
                    onClick={handleLogin}
                >
                    Login
                </button>

                <div className="divider">
                    OR
                </div>

                <button
                    className="google-btn"
                    onClick={handleGoogleLogin}
                >
                    Continue with Google
                </button>

            </div>
        </div>
    );
}

export default Login;