'use client';
import RegisterForm from '../components/RegisterForm';
export default function RegisterPage() {
    return (
        <main className="register-container">
            <h2>Register</h2>
                <h5>* All Fields Required </h5>
            <RegisterForm />
            <h6>Password Requirements</h6>
            <div className="password-requirements">
                <ul>
                    <li>At least 8 characters</li>
                    <li>One uppercase letter</li>
                    <li>One lowercase letter</li>
                    <li>One number</li>
                    <li>No Special Case Symbols </li>
                </ul>
            </div>


            <div className = "redirect-login">
                    <p> Already have an account?  <a href="/login" rel="noreferrer">Sign in</a></p>
            </div>
        </main>
    );
}