const mysql = require('mysql2/promise');

async function updateMenuIcons() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: process.env.DB_PASSWORD || '',
    database: 'linkhiit'
  });

  try {
    //console.log('메뉴 아이콘 업데이트 시작...');

    // 관리자 메뉴 아이콘 설정
    const updates = [
      { name: '관리자 대시보드', icon: 'LayoutDashboard' },
      { name: '운동관리 및 동영상 등록', icon: 'Dumbbell' },
      { name: '공지사항 등록 관리', icon: 'MessageSquare' },
      { name: '메뉴관리', icon: 'Settings' },
      { name: '지점관리', icon: 'Store' },
      { name: '사용자 관리 및 승인', icon: 'User' }
    ];

    for (const update of updates) {
      const [result] = await connection.execute(
        `UPDATE menus SET icon = ? WHERE name = ? AND target_audience = 'admin'`,
        [update.icon, update.name]
      );
      //console.log(`✅ ${update.name} → ${update.icon} (${result.affectedRows} rows updated)`);
    }

    // 결과 확인
    const [rows] = await connection.execute(
      `SELECT id, name, icon, target_audience FROM menus WHERE target_audience = 'admin' ORDER BY sort_order`
    );

    //console.log('\n📋 업데이트된 메뉴 목록:');
    //rows.forEach(row => {
    //console.log(`- ${row.name}: ${row.icon || 'null'}`);
    //});

  } catch (error) {
    console.error('❌ 업데이트 실패:', error);
  } finally {
    await connection.end();
  }
}

updateMenuIcons();
