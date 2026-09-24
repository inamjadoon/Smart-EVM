import pandas as pd
import random
import os

# =========================
# STEP 1: DATASET CREATE
# =========================
file_name = "DelayPred.csv"


if not os.path.exists(file_name):
    print("Dataset not found... creating new dataset")

    data=[]
    for i in range(3000):

        planned_duration = random.randint(3, 18)
        team_size = random.randint(2, 15)
        complexity = random.randint(1, 5)

        bugs = random.randint(0, 50)
        pending_tasks = random.randint(0, 40)

        progress = random.randint(20, 100)
        risk = random.uniform(0.5, 1.5)

        # score logic
        score = (
            (progress * 0.4) +
            (team_size * 2) -
            (complexity * 5) -
            (bugs * 0.3) -
            (pending_tasks * 0.4)
        )

        if score > 60:
            status = "OnTime"
        elif score > 40:
            status = "Risk"
        else:
            status = "Delay"

        data.append([
            planned_duration,
            team_size,
            complexity,
            bugs,
            pending_tasks,
            progress,
            risk,
            status
        ])

    df = pd.DataFrame(data, columns=[
        "planned_duration",
        "team_size",
        "complexity",
        "bugs",
        "pending_tasks",
        "progress",
        "risk",
        "status"
    ])

    df.to_csv("delay_dataset.csv", index=False)

else:
    print("Dataset already exists... using existing file")

# =========================
# STEP 2: MODEL TRAINING
# =========================
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score

data = pd.read_csv("delay_dataset.csv")

X = data[[
    'planned_duration',
    'team_size',
    'complexity',
    'bugs',
    'pending_tasks',
    'progress',
    'risk'
]]

y = data['status']

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

model = RandomForestClassifier(n_estimators=200, random_state=42)
model.fit(X_train, y_train)

# =========================
# STEP 3: ACCURACY
# =========================
y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)

print("\n MODEL ACCURACY:")
print("Accuracy:", round(accuracy, 3))

# =========================
# STEP 4: USER INPUT
# =========================
print("\n ENTER PROJECT DETAILS:")

planned_duration = float(input("Planned duration (months): "))
team_size = float(input("Team size: "))
complexity = float(input("Complexity (1-5): "))
bugs = float(input("Number of bugs: "))
pending_tasks = float(input("Pending tasks: "))
progress = float(input("Progress %: "))
risk = float(input("Risk factor (0.5 - 1.5): "))

# prediction
pred = model.predict([[
    planned_duration,
    team_size,
    complexity,
    bugs,
    pending_tasks,
    progress,
    risk
]])

print("\n Project Status:", pred[0])

# =========================
# STEP 5: REASONS
# =========================
print("\n Analysis:")

if pred[0] == "OnTime":
    print(" Project is healthy and on track")
    print("Reason: High progress + low issues + balanced team")

elif pred[0] == "Risk":
    print(" Project is at risk")
    print("Reason: Moderate bugs or pending tasks affecting progress")

else:
    print(" Project is delayed")
    print("Reasons:")
    if bugs > 20:
        print("- High number of bugs")
    if pending_tasks > 20:
        print("- Too many pending tasks")
    if progress < 50:
        print("- Low progress")
    if complexity >= 4:
        print("- High complexity")