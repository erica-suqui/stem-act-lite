'use client';

import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import * as z from 'zod';
import { apiUrl } from '@/lib/api';


export default function LogIn(){

    const [formData,setFormData] = useState ({
        email: '',
        password: '',
    });

    const [errors, setErrors] = useState({})
    const router = useRouter();
    const [loginError, setLoginError] = useState('');
    const roleRoutes = {
        partner: '/',
        admin: '/superAdminDashboard',
        super_admin: '/superAdminDashboard',
    };

    const LogInSchema = z.object({
        email: z.string().email().min(1,"Missing Email"),
        password: z.string().min(1,"Missing Password")
    });

    const handleChange = (e) => {
        const {name,value } = e.target;
        setFormData(prev => ({...prev,[name]: value}))

        if (errors[name]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    }

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        const userData = LogInSchema.safeParse(formData)

        if (!userData.success){
            setErrors(userData.error.format());
            return;
        }

        try{
            const response = await fetch(apiUrl('/api/login'),{
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                localStorage.setItem('userID', data.userID);
                localStorage.setItem('role', data.role);
                localStorage.setItem('orgId', data.orgId);
                const targetRoute = roleRoutes[data.role] || '/';
                router.push(targetRoute);
            }
            else{
                setLoginError(data.error || 'Login failed');
            }
        }
        catch(error){
            console.error("Error:", error);
            setLoginError("Something went wrong");
        }

       
    };




    return(
        <div className = "login-form">
           <form className = "form-fields-login" onSubmit = {handleFormSubmit}>
                
                <input type = "email" 
                    id = "emai"
                    name="email" 
                    placeholder="Your Email"
                    value = {formData.email}
                    onChange={handleChange}
                />
                {errors.email && <span>{errors.email._errors[0]}</span>}

                <input type = "password" 
                id = "pass"
                name="password" 
                placeholder="Your Password"
                value = {formData.password}
                onChange={handleChange}
                />
                {errors.password && <span>{errors.password._errors[0]}</span>}
                {loginError && <p className="error-message">{loginError}</p>}

                <button type = "submit">Log In</button>

            </form>
        </div>
    );
}
