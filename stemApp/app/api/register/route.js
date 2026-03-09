import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';

export async function POST(request){
    try {
        const body = await request.json();
        const { orgName, email, phone, password } = body;
        
        const hashedPassword = await bcrypt.hash(password, 10);
   
        const result = await pool.query(
            'INSERT INTO organizations (org_name, contact_email,contact_phone) VALUES ($1, $2, $3) RETURNING org_id',
            [orgName,email,phone,]
        );
        const orgID = result.rows[0].org_id
        const userResult =  await pool.query(
            'INSERT INTO users (email, password_hash,role,org_id) VALUES ($1, $2, $3, $4 )',
            [email,hashedPassword,'partner',orgID]
        )
        
        return NextResponse.json({ success: true });
        
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    


    

}