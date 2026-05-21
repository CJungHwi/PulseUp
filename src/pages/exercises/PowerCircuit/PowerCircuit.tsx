import React from 'react'
import { Box, Card, Typography, Button } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { FitnessCenter } from '@mui/icons-material'

const PowerCircuit: React.FC = () => {
  const navigate = useNavigate()

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh', 
      p: 2 
    }}>
      <Card sx={{ 
        textAlign: 'center', 
        p: { xs: 3, sm: 4 }, 
        maxWidth: 500, 
        width: '100%' 
      }}>
        <Box sx={{ mb: 3 }}>
          <FitnessCenter sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', mb: 2 }}>
            Power Circuit
          </Typography>
          <Typography variant="h6" sx={{ mb: 2, color: 'text.secondary' }}>
            파워 서킷 운동
          </Typography>
        </Box>
        
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          고강도 서킷 트레이닝으로 근력과 지구력을 동시에 향상시키는 운동입니다.
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button 
            variant="contained" 
            color="primary"
            onClick={() => navigate('/dashboard')}
          >
            운동 시작
          </Button>
          <Button 
            variant="outlined" 
            onClick={() => navigate(-1)}
          >
            뒤로 가기
          </Button>
        </Box>
      </Card>
    </Box>
  )
}

export default PowerCircuit
