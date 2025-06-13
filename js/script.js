document.getElementById('analyzeBtn').addEventListener('click', startSequence);

function startSequence() {
    // Скрыть кнопку
    document.getElementById('analyzeBtn').classList.add('hidden');
    
    // Показать загрузку
    document.getElementById('loading').classList.remove('hidden');
    
    // Через 2 секунды показать взлом
    setTimeout(() => {
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('hack').classList.remove('hidden');
        
        // Через 2 секунды показать ошибку
        setTimeout(() => {
            document.getElementById('hack').classList.add('hidden');
            document.getElementById('error').classList.remove('hidden');
            
            // Через 2 секунды начать починку
            setTimeout(() => {
               率先
                document.getElementById('error').classList.add('hidden');
                document.getElementById('repair').classList.remove('hidden');
                
                // Через 3 секунды показать финальный текст
                setTimeout(() => {
                    document.getElementById('repair').classList.add('hidden');
                    document.getElementById('final').classList.remove('hidden');
                }, 3000);
            }, 2000);
        }, 2000);
    }, 2000);
}
