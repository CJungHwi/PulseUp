/**
 * 페이지 요약 — MUI 라이선스 (`/mui-license`)
 *
 * 기능: Material UI MIT 라이선스 문구 및 사용 패키지 안내(정적 콘텐츠).
 *
 * 호출/연동: 없음.
 *
 * 관련 컴포넌트: MUI `Container`, `Paper`, `Typography`, `List`.
 *
 * 흐름: 마운트 시 정적 렌더만 수행.
 */

import React from 'react'
import {
  Container,
  Typography,
  Paper,
  Box,
  Divider,
  Link as MuiLink,
  List,
  ListItem,
  ListItemText
} from '@mui/material'

export const MuiLicense: React.FC = () => {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper elevation={2} sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          MUI (Material-UI) 라이선스 고지
        </Typography>

        <Divider sx={{ my: 3 }} />

        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" gutterBottom>
            라이선스 정보
          </Typography>
          <Typography variant="body1" paragraph>
            본 프로젝트는 MUI (Material-UI) 라이브러리를 사용합니다.
            MUI는 MIT 라이선스 하에 배포되는 오픈소스 React UI 프레임워크입니다.
          </Typography>
        </Box>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            MUI MIT 라이선스
          </Typography>
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              backgroundColor: '#0f0f0fff',
              color: '#fff',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              whiteSpace: 'pre-wrap'
            }}
          >
            {`MIT License

Copyright (c) 2014 Call-Em-All

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`}
          </Paper>
        </Box>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            사용된 MUI 컴포넌트
          </Typography>
          <List>
            <ListItem>
              <ListItemText
                primary="@mui/material"
                secondary="핵심 Material-UI 컴포넌트 라이브러리"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="@mui/icons-material"
                secondary="Material Design 아이콘 세트"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="@emotion/react & @emotion/styled"
                secondary="MUI에서 사용하는 CSS-in-JS 라이브러리"
              />
            </ListItem>
          </List>
        </Box>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            관련 링크
          </Typography>
          <List>
            <ListItem>
              <MuiLink
                href="https://mui.com/"
                target="_blank"
                rel="noopener noreferrer"
                sx={{ textDecoration: 'none' }}
              >
                MUI 공식 웹사이트
              </MuiLink>
            </ListItem>
            <ListItem>
              <MuiLink
                href="https://github.com/mui/material-ui"
                target="_blank"
                rel="noopener noreferrer"
                sx={{ textDecoration: 'none' }}
              >
                MUI GitHub 저장소
              </MuiLink>
            </ListItem>
            <ListItem>
              <MuiLink
                href="https://github.com/mui/material-ui/blob/master/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
                sx={{ textDecoration: 'none' }}
              >
                MUI 라이선스 원문
              </MuiLink>
            </ListItem>
          </List>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Typography variant="body2" color="text.secondary">
          이 고지사항은 오픈소스 소프트웨어의 적절한 사용을 위해 제공됩니다.
          MUI의 사용은 위 MIT 라이선스 조건을 준수합니다.
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          마지막 업데이트: {new Date().toLocaleDateString('ko-KR')}
        </Typography>
      </Paper>
    </Container>
  )
}


