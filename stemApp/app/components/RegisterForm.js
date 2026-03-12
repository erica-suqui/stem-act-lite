'use client';

import React, { useState } from 'react';
import * as z from "zod";
import { useRouter } from 'next/navigation';
import { apiUrl } from '@/lib/api';

export default function RegisterForm(){
    //Form Data
    const [formData,setFormData] = useState ({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
        orgName: '',
        phone: '',
    });

    //Form Errors to raise Flags using Zod Library 
    const [errors, setErrors] = useState({})
    const [showModal, setShowModal] = useState(false);


    const registerSchema = z.object({
        firstName: z.string().min(1, "First name required"),
        lastName: z.string().min(1, "Last name required"),
        orgName : z.string().min(1, "Organization Name Required"),
        email: z.string().email("Invalid email address"),
        phone: z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits (no dashes or spaces)"),
        password : z.string().min(8,"Please ensure your password has at least 8 characters").refine((value)=>/[A-Z]/.test(value), {
            message: "Your Password must have a Capital Letter"}).refine((value)=>/[a-z]/.test(value),{
            message:"You must have at least a lowercase letter"}).refine((value)=>/[0-9]/.test(value),{
            message: "You must have at least 1 numerical number"
            }),
        confirmPassword : z.string()
    }).refine(formData => formData.password == formData.confirmPassword, {
        message: "Passwords do not match",
        path: ['confirmPassword']
    });

    const navigate = useRouter();

    const handleChange = (e) => {
        const {name,value} = e.target;
        setFormData(prev => ({...prev,[name]: value}))
        if (errors[name]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    }

    const handleFormSubmit = async(e) => {
        e.preventDefault();
        const userData = registerSchema.safeParse(formData)
        if (!userData.success){
                setErrors(userData.error.format());
                return;
        }

        try {
            const response = await fetch(apiUrl('/api/register'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)  
            });
           const data = await response.json();  

            if (data.success) {
                setShowModal(true);
                setTimeout(() => {
                    navigate.push("/login");
                }, 2000);
            } else {
                alert("Error: " + data.error);
            }     
        } 
        catch (error) {
            console.error("Error:", error);
            alert("Something went wrong!");
        }


    };
    
    return (
        <div className = "register-form">
            <form className = "form-fields" onSubmit = {handleFormSubmit}>
                <p>First Name:</p>
                <input
                type="text"
                name="firstName"
                placeholder="First Name"
                value={formData.firstName}
                onChange={handleChange}
                />
                {errors.firstName && <span>{errors.firstName._errors[0]}</span>}

                <p>Last Name:</p>
                <input
                type="text"
                name="lastName"
                placeholder="Last Name"
                value={formData.lastName}
                onChange={handleChange}
                />
                {errors.lastName && <span>{errors.lastName._errors[0]}</span>}
                
                <p >Organization Name:</p>
                <input type = "text" 
                id = "org"
                name="orgName" 
                placeholder="Your Orgnization Name"
                value = {formData.orgName}
                onChange={handleChange}
                />
                {errors.orgName && <span>{errors.orgName._errors[0]}</span>}

                <p>Email: </p>
                <input type = "email" 
                name="email" 
                placeholder="email@organizaiton.org"
                value = {formData.email}
                onChange={handleChange}
                />
                {errors.email && <span>{errors.email._errors[0]}</span>}

                <p>Phone: </p>
                <input type = "text" 
                name="phone" 
                placeholder="000-000-000"
                value = {formData.phone}
                onChange={handleChange}
                />
                {errors.phone && <span>{errors.phone._errors[0]}</span>}

                <p>Password: </p>
                <input type = "password" 
                name="password" 
                placeholder="Please Enter a Password"
                value = {formData.password}
                onChange={handleChange}
                />
                {errors.password && <span>{errors.password._errors[0]}</span>}
                
                <p>Confirm Password: </p>
                <input type = "password" 
                name="confirmPassword" 
                placeholder="Please Confirm Your Password"
                value = {formData.confirmPassword}
                onChange={handleChange}
                />
                {errors.confirmPassword && <span>{errors.confirmPassword._errors[0]}</span>}
                <button type = "submit" >Submit</button>

                
            </form>
            {showModal && (
            <div className="modal-overlay-register-page">
                <div className="modal-box-register-page">
                <p>Registration successful! Redirecting to login...</p>
                </div>
            </div>
            )}
        </div>
    );
}
