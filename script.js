class CalorieTracker {
    constructor() {
        this.selectedFood = null;
        this.dailyEntries = [];
        this.dailyGoal = 2000;
        this.macroGoals = {
            protein: 150,
            carbs: 225,
            fat: 67
        };
        this.logsByDate = {}; // { 'YYYY-MM-DD': [entries] }
        this.selectedDate = this.getToday();

        this.initializeElements();
        this.loadFromStorage();
        this.bindEvents();
        this.loadLogForDate(this.selectedDate);
        this.updateFoodLog();
        this.updateProgress();
        this.updateMacroGoals();
    }

    getToday() {
        return new Date().toISOString().slice(0, 10);
    }

    initializeElements() {
        this.elements = {
            dailyGoal: document.getElementById('daily-goal'),
            foodSearch: document.getElementById('food-search'),
            searchResults: document.getElementById('search-results'),
            searchError: document.getElementById('search-error'),
            searchSpinner: document.getElementById('search-spinner'),
            addFoodSection: document.getElementById('add-food-section'),
            foodQuantity: document.getElementById('food-quantity'),
            totalCaloriesPreview: document.getElementById('total-calories-preview'),
            addFoodBtn: document.getElementById('add-food-btn'),
            foodLog: document.getElementById('food-log'),
            clearLogBtn: document.getElementById('clear-log-btn'),
            currentCalories: document.getElementById('current-calories'),
            goalCalories: document.getElementById('goal-calories'),
            remainingCalories: document.getElementById('remaining-calories'),
            progressFill: document.getElementById('progress-fill'),
            consumedDisplay: document.getElementById('consumed-display'),
            remainingDisplay: document.getElementById('remaining-display'),
            foodsCount: document.getElementById('foods-count'),
            proteinConsumed: document.getElementById('protein-consumed'),
            carbsConsumed: document.getElementById('carbs-consumed'),
            fatConsumed: document.getElementById('fat-consumed'),
            proteinGoal: document.getElementById('protein-goal'),
            carbsGoal: document.getElementById('carbs-goal'),
            fatGoal: document.getElementById('fat-goal'),
            logDate: document.getElementById('log-date')
        };
    }

    bindEvents() {
        this.elements.dailyGoal.addEventListener('change', (e) => {
            this.dailyGoal = parseInt(e.target.value);
            this.saveToStorage(); // Save after goal change
            this.updateMacroGoals();
            this.updateProgress();
        });

        let searchTimeout;
        this.elements.foodSearch.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();

            if (query.length === 0) {
                this.elements.searchResults.innerHTML = '';
                this.hideAddFoodSection();
                return;
            }

            searchTimeout = setTimeout(() => {
                this.searchFoods(query);
            }, 500);
        });

        this.elements.foodQuantity.addEventListener('input', () => {
            this.updateCaloriePreview();
        });

        this.elements.addFoodBtn.addEventListener('click', () => {
            this.addFoodToDaily();
        });

        this.elements.clearLogBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all logged foods?')) {
                if (this.logsByDate[this.selectedDate]) {
                    this.logsByDate[this.selectedDate] = [];
                    this.saveToStorage();
                }
                this.loadLogForDate(this.selectedDate);
                this.updateFoodLog();
                this.updateProgress();
            }
        });

        this.elements.logDate.value = this.selectedDate;
        this.elements.logDate.addEventListener('change', (e) => {
            this.selectedDate = e.target.value;
            this.loadLogForDate(this.selectedDate);
            this.updateFoodLog();
            this.updateProgress();
        });
    }

    updateMacroGoals() {
        // Update macro goals based on the daily calorie goal
        this.macroGoals = {
            protein: Math.round(this.dailyGoal * 0.3 / 4),  // 30% of calories (4 cal/g)
            carbs: Math.round(this.dailyGoal * 0.45 / 4),   // 45% of calories (4 cal/g)
            fat: Math.round(this.dailyGoal * 0.25 / 9)      // 25% of calories (9 cal/g)
        };

        this.elements.proteinGoal.textContent = `Goal: ${this.macroGoals.protein}g`;
        this.elements.carbsGoal.textContent = `Goal: ${this.macroGoals.carbs}g`;
        this.elements.fatGoal.textContent = `Goal: ${this.macroGoals.fat}g`;
    }

    async searchFoods(query) {
        this.elements.searchSpinner.style.display = 'block';
        this.elements.searchError.style.display = 'none';
        this.elements.searchResults.innerHTML = '';

        try {
            // Only use backend endpoint
            const response = await fetch(
                'http://localhost:3001/api/foods/search?query=' + encodeURIComponent(query) + '&pageSize=20'
            );

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();

            if (data.foods && data.foods.length > 0) {
                this.displaySearchResults(data.foods);
            } else {
                this.displayNoResults();
            }
        } catch (error) {
            this.elements.searchError.style.display = 'block';
            this.elements.searchResults.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: #718096;">
          <i class="fas fa-exclamation-circle" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
          <p>Failed to load food data. Please check your connection and try again.</p>
        </div>
      `;
        } finally {
            this.elements.searchSpinner.style.display = 'none';
        }
    }

    displaySearchResults(foods) {
        // Store foods for reference by index
        this._lastFoods = foods;

        const resultsHtml = foods.map((food, idx) => {
            // Extract nutrients from foodNutrients array
            const nutrients = food.foodNutrients || [];
            const getNutrient = id => {
                const n = nutrients.find(n => n.nutrientId === id);
                return n ? n.value : 0;
            };
            const calories = getNutrient(1008);
            const protein = getNutrient(1003);
            const carbs = getNutrient(1005);
            const fat = getNutrient(1004);

            return `
        <div class="food-item" data-idx="${idx}">
          <div class="food-info">
            <h3>${food.description}</h3>
            ${food.brandOwner ? `<div class="brand">${food.brandOwner}</div>` : ''}
            <div class="serving">Serving: ${food.servingSize || 100}${food.servingSizeUnit || 'g'}</div>
            <div class="macro-nutrients">
              <div class="macro-item protein">
                <span class="label">Protein:</span>
                <span>${Math.round(protein)}g</span>
              </div>
              <div class="macro-item carbs">
                <span class="label">Carbs:</span>
                <span>${Math.round(carbs)}g</span>
              </div>
              <div class="macro-item fat">
                <span class="label">Fat:</span>
                <span>${Math.round(fat)}g</span>
              </div>
            </div>
          </div>
          <div class="food-calories">
            <div class="calories">${Math.round(calories)}</div>
            <div class="per-serving">calories</div>
          </div>
        </div>
      `;
        }).join('');

        this.elements.searchResults.innerHTML = resultsHtml;

        this.elements.searchResults.querySelectorAll('.food-item').forEach(item => {
            item.addEventListener('click', () => {
                this.elements.searchResults.querySelectorAll('.food-item').forEach(i => {
                    i.classList.remove('selected');
                });
                item.classList.add('selected');
                const idx = parseInt(item.dataset.idx, 10);
                const food = this._lastFoods[idx];
                // Extract nutrients again for selectedFood
                const nutrients = food.foodNutrients || [];
                const getNutrient = id => {
                    const n = nutrients.find(n => n.nutrientId === id);
                    return n ? n.value : 0;
                };
                this.selectedFood = {
                    description: food.description,
                    brandOwner: food.brandOwner || '',
                    servingSize: food.servingSize || 100,
                    servingSizeUnit: food.servingSizeUnit || 'g',
                    calories: getNutrient(1008),
                    protein: getNutrient(1003),
                    carbs: getNutrient(1005),
                    fat: getNutrient(1004)
                };
                this.showAddFoodSection();
                this.updateCaloriePreview();
            });
        });
    }

    displayNoResults() {
        this.elements.searchResults.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: #718096;">
        <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
        <p>No foods found. Try a different search term.</p>
      </div>
    `;
    }

    showAddFoodSection() {
        this.elements.addFoodSection.style.display = 'block';
    }

    hideAddFoodSection() {
        this.elements.addFoodSection.style.display = 'none';
        this.selectedFood = null;
    }

    updateCaloriePreview() {
        if (!this.selectedFood) return;

        const quantity = parseFloat(this.elements.foodQuantity.value) || 1;
        const totalCalories = Math.round(this.selectedFood.calories * quantity);
        const totalProtein = Math.round(this.selectedFood.protein * quantity);
        const totalCarbs = Math.round(this.selectedFood.carbs * quantity);
        const totalFat = Math.round(this.selectedFood.fat * quantity);

        this.elements.totalCaloriesPreview.innerHTML = `
      <span>${totalCalories} calories</span>
      <div class="macro-nutrients" style="margin-top: 0.5rem;">
        <span class="macro-item protein">
          <span class="label">P:</span>
          <span>${totalProtein}g</span>
        </span>
        <span class="macro-item carbs">
          <span class="label">C:</span>
          <span>${totalCarbs}g</span>
        </span>
        <span class="macro-item fat">
          <span class="label">F:</span>
          <span>${totalFat}g</span>
        </span>
      </div>
    `;
    }

    addFoodToDaily() {
        if (!this.selectedFood) return;
        const quantity = parseFloat(this.elements.foodQuantity.value) || 1;
        const totalCalories = Math.round(this.selectedFood.calories * quantity);
        const totalProtein = Math.round(this.selectedFood.protein * quantity);
        const totalCarbs = Math.round(this.selectedFood.carbs * quantity);
        const totalFat = Math.round(this.selectedFood.fat * quantity);

        const entry = {
            id: Date.now(),
            food: this.selectedFood,
            quantity,
            totalCalories,
            totalProtein,
            totalCarbs,
            totalFat,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        if (!this.logsByDate[this.selectedDate]) this.logsByDate[this.selectedDate] = [];
        this.logsByDate[this.selectedDate].push(entry);
        this.saveToStorage();
        this.loadLogForDate(this.selectedDate);
        this.updateFoodLog();
        this.updateProgress();

        this.elements.foodSearch.value = '';
        this.elements.searchResults.innerHTML = '';
        this.elements.foodQuantity.value = 1;
        this.hideAddFoodSection();
    }

    updateFoodLog() {
        const dailyEntries = this.dailyEntries || [];

        if (dailyEntries.length === 0) {
            this.elements.foodLog.innerHTML = `
        <div class="empty-log">
          <i class="fas fa-utensils empty-icon"></i>
          <p>No foods logged today.</p>
          <p>Start by searching and adding foods above!</p>
        </div>
      `;
            this.elements.clearLogBtn.style.display = 'none';
        } else {
            const entriesHtml = dailyEntries.map(entry => `
        <div class="log-entry" data-id="${entry.id}">
          <div class="log-entry-info">
            <h4>${entry.food.description}</h4>
            ${entry.food.brandOwner ? `<div class="brand">${entry.food.brandOwner}</div>` : ''}
            <div class="serving-size">
              <span class="serving-display">${entry.quantity} × ${entry.food.servingSize}${entry.food.servingSizeUnit} • ${entry.timestamp}</span>
              <span class="serving-edit" style="display:none;">
                <input type="number" class="edit-quantity" value="${entry.quantity}" min="0.1" step="0.1" style="width:60px;">
                <button class="save-edit btn btn-primary" style="padding:0.25rem 0.5rem;font-size:0.8rem;">Save</button>
                <button class="cancel-edit btn btn-secondary" style="padding:0.25rem 0.5rem;font-size:0.8rem;">Cancel</button>
              </span>
            </div>
          </div>
          <div class="log-entry-macros">
            <span class="macro-pill protein">
              <span>${entry.totalProtein}g</span>
              <span>P</span>
            </span>
            <span class="macro-pill carbs">
              <span>${entry.totalCarbs}g</span>
              <span>C</span>
            </span>
            <span class="macro-pill fat">
              <span>${entry.totalFat}g</span>
              <span>F</span>
            </span>
          </div>
          <div class="log-entry-calories">
            ${entry.totalCalories}
            <small>cal</small>
          </div>
          <button class="edit-btn btn btn-secondary" style="padding:0.25rem 0.5rem;font-size:0.8rem;">
            <i class="fas fa-pen"></i>
          </button>
          <button class="remove-btn" onclick="calorieTracker.removeFoodEntry(${entry.id})">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `).join('');

            this.elements.foodLog.innerHTML = entriesHtml;
            this.elements.clearLogBtn.style.display = 'block';

            // Edit button logic
            this.elements.foodLog.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', function () {
                    const entryDiv = btn.closest('.log-entry');
                    entryDiv.querySelector('.serving-display').style.display = 'none';
                    entryDiv.querySelector('.serving-edit').style.display = '';
                });
            });
            this.elements.foodLog.querySelectorAll('.cancel-edit').forEach(btn => {
                btn.addEventListener('click', function () {
                    const entryDiv = btn.closest('.log-entry');
                    entryDiv.querySelector('.serving-edit').style.display = 'none';
                    entryDiv.querySelector('.serving-display').style.display = '';
                });
            });
            const tracker = this;
            this.elements.foodLog.querySelectorAll('.save-edit').forEach(btn => {
                btn.addEventListener('click', function () {
                    const entryDiv = btn.closest('.log-entry');
                    const id = Number(entryDiv.getAttribute('data-id'));
                    const newQty = parseFloat(entryDiv.querySelector('.edit-quantity').value) || 1;
                    tracker.editFoodEntry(id, newQty);
                });
            });
        }
    }

    removeFoodEntry(id) {
        if (!this.logsByDate[this.selectedDate]) return;
        this.logsByDate[this.selectedDate] = this.logsByDate[this.selectedDate].filter(entry => entry.id !== id);
        this.saveToStorage();
        this.loadLogForDate(this.selectedDate);
        this.updateFoodLog();
        this.updateProgress();
    }

    editFoodEntry(id, newQuantity) {
        if (!this.logsByDate[this.selectedDate]) return;
        const entry = this.logsByDate[this.selectedDate].find(e => e.id === id);
        if (!entry) return;
        entry.quantity = newQuantity;
        entry.totalCalories = Math.round(entry.food.calories * newQuantity);
        entry.totalProtein = Math.round(entry.food.protein * newQuantity);
        entry.totalCarbs = Math.round(entry.food.carbs * newQuantity);
        entry.totalFat = Math.round(entry.food.fat * newQuantity);
        entry.timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        this.saveToStorage();
        this.loadLogForDate(this.selectedDate);
        this.updateFoodLog();
        this.updateProgress();
    }

    updateProgress() {
        const totalCalories = this.dailyEntries.reduce((sum, entry) => sum + entry.totalCalories, 0);
        const totalProtein = this.dailyEntries.reduce((sum, entry) => sum + entry.totalProtein, 0);
        const totalCarbs = this.dailyEntries.reduce((sum, entry) => sum + entry.totalCarbs, 0);
        const totalFat = this.dailyEntries.reduce((sum, entry) => sum + entry.totalFat, 0);

        const remainingCalories = this.dailyGoal - totalCalories;
        const progressPercentage = Math.min((totalCalories / this.dailyGoal) * 100, 100);

        this.elements.currentCalories.textContent = totalCalories;
        this.elements.goalCalories.textContent = this.dailyGoal;
        this.elements.consumedDisplay.textContent = `${totalCalories} cal`;
        this.elements.foodsCount.textContent = this.dailyEntries.length;

        // Update macro displays
        this.elements.proteinConsumed.textContent = `${totalProtein}g`;
        this.elements.carbsConsumed.textContent = `${totalCarbs}g`;
        this.elements.fatConsumed.textContent = `${totalFat}g`;

        if (remainingCalories >= 0) {
            this.elements.remainingCalories.textContent = `${remainingCalories} remaining`;
            this.elements.remainingCalories.className = 'remaining';
            this.elements.remainingDisplay.textContent = `${remainingCalories} cal`;
        } else {
            this.elements.remainingCalories.textContent = `${Math.abs(remainingCalories)} over`;
            this.elements.remainingCalories.className = 'over';
            this.elements.remainingDisplay.textContent = `${Math.abs(remainingCalories)} over`;
        }

        this.elements.progressFill.style.width = `${progressPercentage}%`;

        if (progressPercentage > 100) {
            this.elements.progressFill.classList.add('over-goal');
        } else {
            this.elements.progressFill.classList.remove('over-goal');
        }
    }

    loadLogForDate(date) {
        this.dailyEntries = this.logsByDate[date] ? [...this.logsByDate[date]] : [];
    }

    // Save data to localStorage
    saveToStorage() {
        const data = {
            logsByDate: this.logsByDate,
            dailyGoal: this.dailyGoal
        };
        localStorage.setItem('calorieTrackerData', JSON.stringify(data));
    }

    // Load data from localStorage
    loadFromStorage() {
        const data = localStorage.getItem('calorieTrackerData');
        if (data) {
            try {
                const parsed = JSON.parse(data);
                this.logsByDate = parsed.logsByDate || {};
                this.dailyGoal = parsed.dailyGoal || 2000;
                // Sync the input field with the loaded goal
                if (this.elements && this.elements.dailyGoal) {
                    this.elements.dailyGoal.value = this.dailyGoal;
                }
            } catch (e) {
                this.logsByDate = {};
                this.dailyGoal = 2000;
                if (this.elements && this.elements.dailyGoal) {
                    this.elements.dailyGoal.value = this.dailyGoal;
                }
            }
        }
    }
}

// Initialize Calorie Tracker
document.addEventListener('DOMContentLoaded', () => {
    window.calorieTracker = new CalorieTracker();
});

// Calorie Estimator Logic
document.addEventListener('DOMContentLoaded', () => {
    const estimatorForm = document.getElementById('calorie-estimator-form');
    const estimatorResult = document.getElementById('calorie-estimator-result');

    if (estimatorForm) {
        estimatorForm.addEventListener('submit', function (e) {
            e.preventDefault();
            // Get values
            const age = parseInt(document.getElementById('estimator-age').value, 10);
            const gender = document.getElementById('estimator-gender').value;
            const height = parseFloat(document.getElementById('estimator-height').value);
            const weight = parseFloat(document.getElementById('estimator-weight').value);
            const activity = parseFloat(document.getElementById('estimator-activity').value);

            // Mifflin-St Jeor Equation
            let bmr;
            if (gender === 'male') {
                bmr = 10 * weight + 6.25 * height - 5 * age + 5;
            } else {
                bmr = 10 * weight + 6.25 * height - 5 * age - 161;
            }
            const calories = Math.round(bmr * activity);

            estimatorResult.innerHTML = `
        <span>Estimated daily calories: <strong>${calories} kcal</strong></span>
        <button id="set-daily-goal-btn" class="btn btn-secondary" style="margin-left:1rem;">Set as Goal</button>
      `;

            // Set as goal button
            document.getElementById('set-daily-goal-btn').onclick = function () {
                const dailyGoalInput = document.getElementById('daily-goal');
                if (dailyGoalInput) {
                    dailyGoalInput.value = calories;
                    if (window.calorieTracker) {
                        window.calorieTracker.dailyGoal = calories;
                        window.calorieTracker.elements.dailyGoal.value = calories; // <-- Sync input field
                        window.calorieTracker.updateMacroGoals();
                        window.calorieTracker.updateProgress();
                        window.calorieTracker.saveToStorage();
                    }
                }
            };
        });
    }
});

function saveEstimatorInputs() {
    const estimatorData = {
        age: document.getElementById('estimator-age').value,
        gender: document.getElementById('estimator-gender').value,
        height: document.getElementById('estimator-height').value,
        weight: document.getElementById('estimator-weight').value,
        activity: document.getElementById('estimator-activity').value
    };
    localStorage.setItem('calorieEstimatorInputs', JSON.stringify(estimatorData));
}

function loadEstimatorInputs() {
    const data = localStorage.getItem('calorieEstimatorInputs');
    if (data) {
        try {
            const estimatorData = JSON.parse(data);
            if (estimatorData.age) document.getElementById('estimator-age').value = estimatorData.age;
            if (estimatorData.gender) document.getElementById('estimator-gender').value = estimatorData.gender;
            if (estimatorData.height) document.getElementById('estimator-height').value = estimatorData.height;
            if (estimatorData.weight) document.getElementById('estimator-weight').value = estimatorData.weight;
            if (estimatorData.activity) document.getElementById('estimator-activity').value = estimatorData.activity;
        } catch (e) { }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadEstimatorInputs();
});

// Add event listeners to save on every change
document.addEventListener('DOMContentLoaded', () => {
    ['estimator-age', 'estimator-gender', 'estimator-height', 'estimator-weight', 'estimator-activity'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', saveEstimatorInputs);
            el.addEventListener('input', saveEstimatorInputs);
        }
    });
}); 