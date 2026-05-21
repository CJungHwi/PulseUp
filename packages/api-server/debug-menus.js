const mysql = require('mysql2/promise');

async function checkMenuData() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'root',
      database: 'workout_system'
    });

    //console.log('=== 메뉴 테이블 전체 상태 ===');
    const [allMenus] = await connection.execute('SELECT COUNT(*) as count FROM menus');
    //console.log('전체 메뉴 개수:', allMenus[0].count);

    const [activeMenus] = await connection.execute('SELECT name, menu_type, target_audience, is_active, is_visible, sort_order FROM menus ORDER BY sort_order');
    //console.log('메뉴 목록:');
    activeMenus.forEach((menu, i) => {
      console.log(`${i + 1}. ${menu.name} (${menu.menu_type}) - audience: ${menu.target_audience}, active: ${menu.is_active}, visible: ${menu.is_visible}`);
    });

    //console.log('\n=== 프로시저 직접 실행 ===');
    const [procResult] = await connection.execute('CALL sp_get_user_menu_tree(?, ?)', ['eace9fa8-7a59-11f0-a925-8c8caa6f77e3', 'admin']);
    //console.log('프로시저 결과 개수:', procResult.length);
    // procResult.forEach((menu, i) => {
    //   console.log(`${i+1}. ${menu.name} (${menu.menu_type}) - ${menu.url || 'no url'}`);
    // });

  } catch (error) {
    console.error('에러:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

checkMenuData();
