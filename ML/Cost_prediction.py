import pandas as pd
import random
import os
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error
import numpy as np

file_name = "cost_dataset.csv"


if not os.path.exists(file_name):
    print("Dataset not found... creating new dataset")

    data = []

    for i in range(3000):   
        budget = random.randint(20000, 150000)
        duration = random.randint(3, 18)
        team_size = random.randint(2, 15)
        complexity = random.randint(1, 5)

        risk_factor = random.uniform(0.8, 1.5)

        actual_cost = (
            budget * risk_factor +
            (complexity * 4000) +
            (duration * 1500) -
            (team_size * 800)
        )

        actual_cost = max(actual_cost, budget * 0.7)

        data.append([budget, duration, team_size, complexity, actual_cost])

    df = pd.DataFrame(data, columns=[
        'budget', 'duration', 'team_size', 'complexity', 'actual_cost'
    ])

    df.to_csv(file_name, index=False)
    print("Dataset created and saved!")

else:
    print("Dataset already exists... using existing file")


data = pd.read_csv(file_name)

# Feature Engineering
data['cost_per_person'] = data['budget'] / data['team_size']

X = data[['budget', 'duration', 'team_size', 'complexity', 'cost_per_person']]
y = data['actual_cost']

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

model = RandomForestRegressor(
    n_estimators=300,
    max_depth=10,
    min_samples_split=5,
    min_samples_leaf=2,
    random_state=42
)

model.fit(X_train, y_train)

y_pred = model.predict(X_test)

r2 = r2_score(y_test, y_pred)

print("\n Model Performance:")
print("R2 Score (Accuracy):", round(r2, 3))



print("\n Enter Project Details:")

budget = float(input("Enter budget in Lakhs: "))
duration = float(input("Enter duration in months: "))
team = float(input("Enter team size: "))
complexity = float(input("Enter complexity from 1 to 5: "))

cost_per_person = budget / team

input_data = pd.DataFrame([[
    budget, duration, team, complexity, cost_per_person
]], columns=['budget', 'duration', 'team_size', 'complexity', 'cost_per_person'])

predicted_cost = model.predict(input_data)

print("\n Predicted Cost in Lakhs is:", round(predicted_cost[0], 2))

if predicted_cost > budget:
    print(" Cost Overrun Expected.....")

    reasons = []

if complexity >= 4:
        reasons.append("High complexity increases development effort")
if team <= 4:
        reasons.append("Small team size slows down development")

if duration >= 12:
        reasons.append("Long project duration increases overhead cost")

if budget < 50000:
        reasons.append("Low initial budget increases risk of overrun")

print(" Following are the main Reasons:")

if len(reasons) == 0:
        print("- No strong risk factors detected (but cost still high due to model prediction)")

else:
    for r in reasons:
        print("-", r)



import matplotlib.pyplot as plt

time = list(range(1, int(duration)+1))

pv = [(budget/len(time)) * t for t in time]
ev = [p * random.uniform(0.8, 1.0) for p in pv]
ac = [p * random.uniform(1.0, 1.3) for p in pv]

plt.plot(time, pv, label="PV (Planned Value)")
plt.plot(time, ev, label="EV (Earned Value)")
plt.plot(time, ac, label="AC (Actual Cost)")

plt.xlabel("Time (Months)")
plt.ylabel("Cost")
plt.title("Earned Value Analysis - Project Cost vs Performance Tracking")
plt.legend()
plt.grid(True)
plt.show()
