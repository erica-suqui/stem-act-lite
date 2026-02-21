import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';

export async function POST(request){
    const roleID = {}
    try{
        const body = await request.json();

        const { email, password } = body;

        const result = await pool.query(`
        SELECT email, password_hash, role, org_id, user_id FROM users WHERE email = $1`,
        [email]
        )

        if (result.rows.length == 0){
            return NextResponse.json({
               success : false,
               error : "Invalid email or password", 
            } , { status: 401 });

            }
        
            const user = result.rows[0]
            const valid = await bcrypt.compare(password,user.password_hash);

            if(!valid){
                return NextResponse.json({
                    success: false,
                    error: "Invalid email or password",
                    }, {status: 401});
            }

            return NextResponse.json({
                success: true,
                userID : user.user_id,
                role: user.role,
                orgId: user.org_id
            }

            );
            


        }
    catch(error){
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }

}
