'use client'

import { useState } from 'react';
import { apiUrl } from '@/lib/api';
import {
    TextField,
    Dialog,
    DialogActions,
    DialogTitle,
    DialogContent,
    Button,
    Alert,
  } from '@mui/material';


export default function SendMessageButton({ orgID,orgName }){
    const [ showDialog, setShowDialog] = useState(false);
    const [ message,setMessage ] = useState('');
    const [ loading, setLoading ] = useState(false);
    const [ error, setError ] = useState('');

    const handleSend = async () =>{
        setLoading(true);
        try{
            fetch(apiUrl(`/api/sendAMessage`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ org_id: orgId, message }),
            });
            const data = await res.json();
            if (data.success) {
                setShowDialog(false);
                setMessage('');
            }
        }catch{
            setError('Failed to send message. Please try again.');
        }finally{
            setLoading(false);
        }
    }

    return(
        <>
        <Button variant="outlined" aria-label = "Send a message to the organization "onClick={() => setShowDialog(true)}>
            Send Message
        </Button>

        <Dialog open={showDialog} onClose={() => setShowDialog(false)} maxWidth="sm" fullWidth>
            <DialogTitle>Message {orgName}</DialogTitle>
            <DialogContent>
                <TextField
                    label="Message"
                    multiline
                    rows={4}
                    fullWidth
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    sx={{ mt: 1 }}
                />
                {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
            </DialogContent>
            <DialogActions>
                <Button onClick={() => setShowDialog(false)}>Cancel</Button>
                <Button variant="contained" onClick={handleSend} disabled={loading || !message.trim()}>
                    {loading ? 'Sending...' : 'Send'}
                </Button>
            </DialogActions>
        </Dialog>
    </>
    )


}
