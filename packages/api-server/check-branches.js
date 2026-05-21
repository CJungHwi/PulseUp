const { executeQuery } = require('./dist/lib/database.js');

async function checkBranches() {
  try {
    //console.log('지점 데이터 확인 중...');

    // 지점 테이블 구조 확인
    const structure = await executeQuery('DESCRIBE branches');
    //console.log('지점 테이블 구조:');
    // structure.forEach(col => {
    //   console.log(`- ${col.Field}: ${col.Type}`);
    // });

    // 지점 데이터 조회
    const branches = await executeQuery('SELECT * FROM branches ORDER BY name');
    //console.log('\n현재 지점 목록:');

    // if (branches.length === 0) {
    //   console.log('지점 데이터가 없습니다. 테스트 데이터를 추가합니다.');

    //   await executeQuery(`
    //     INSERT INTO branches (name, address, phone, region, manager) VALUES 
    //     ('강남점', '서울시 강남구 테헤란로 123', '02-1234-5678', '서울', '김강남'),
    //     ('부산점', '부산시 해운대구 해운대로 456', '051-9876-5432', '부산', '이부산'),
    //     ('대구점', '대구시 중구 중앙대로 789', '053-5555-1234', '대구', '박대구')
    //   `);

    //   console.log('테스트 지점 데이터가 추가되었습니다.');

    //   // 다시 조회
    //   const newBranches = await executeQuery('SELECT * FROM branches ORDER BY name');
    //   newBranches.forEach(branch => {
    //     console.log(`- ID: ${branch.id}, 이름: ${branch.name}, 지역: ${branch.region}`);
    //   });
    // } else {
    //   branches.forEach(branch => {
    //     console.log(`- ID: ${branch.id}, 이름: ${branch.name}, 지역: ${branch.region}`);
    //   });
    // }

  } catch (error) {
    console.error('오류:', error);
  }
}

checkBranches();

