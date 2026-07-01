import bg from "./assets/login-bg.png";
import "./styles/login.css";

import { useState, useEffect } from "react";

import { auth, googleProvider } from "./firebase";

import {
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    signInWithRedirect,
    getRedirectResult
} from "firebase/auth";

function Login({ setUser }) {

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    // ==========================
    // HANDLE GOOGLE REDIRECT RESULT
    // ==========================

    useEffect(() => {

        getRedirectResult(auth)
            .then((result) => {

                if (result) {

                    console.log(result.user);

                    setUser(result.user);

                    alert("✅ Google Login Successful");

                }

            })
            .catch((error) => {

                console.log(error);

            });

    }, [setUser]);

    // ==========================
    // EMAIL LOGIN
    // ==========================

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

            const userCredential =
                await signInWithEmailAndPassword(
                    auth,
                    email,
                    password
                );

            console.log(userCredential.user);

            setUser(userCredential.user);

            alert("✅ Login Successful");

        } catch (error) {

            switch (error.code) {

                case "auth/user-not-found":
                    alert("No account found with this Email.");
                    break;

                case "auth/wrong-password":
                    alert("Incorrect Password.");
                    break;

                case "auth/invalid-email":
                    alert("Invalid Email Address.");
                    break;

                case "auth/invalid-credential":
                    alert("Invalid Email or Password.");
                    break;

                case "auth/too-many-requests":
                    alert("Too many attempts. Please try again later.");
                    break;

                default:
                    alert(error.message);

            }

        }

    };

    // ==========================
    // GOOGLE LOGIN
    // ==========================

    const handleGoogleLogin = async () => {
    try {

        const result = await signInWithPopup(auth, googleProvider);

        console.log("SUCCESS");
        console.log(result);

        alert("Google Login Success");

        setUser(result.user);

    } catch (error) {

    console.error("Google Login Error:", error);

    alert(
        JSON.stringify({
            code: error?.code,
            message: error?.message,
            name: error?.name
        })
    );

}
};

    // ==========================
    // FORGOT PASSWORD
    // ==========================

    const handleForgotPassword = async () => {

        if (!email.trim()) {

            alert("Please enter your Email first.");

            return;

        }

        try {

            await sendPasswordResetEmail(auth, email);

            alert("✅ Password Reset Email Sent.\n\nPlease check your Gmail Inbox.");

        }

        catch (error) {

            switch (error.code) {

                case "auth/user-not-found":
                    alert("No account found with this Email.");
                    break;

                case "auth/invalid-email":
                    alert("Invalid Email Address.");
                    break;

                default:
                    alert(error.message);

            }

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