EC2 SETUP (to view the live database on the server)

REQUIREMENTS:
    - Docker must be installed on EC2 (not Docker Desktop, just docker.io)
    - Install on EC2 if needed:
          sudo apt update && sudo apt install -y docker.io docker-compose-plugin
          sudo systemctl start docker
          sudo systemctl enable docker
          sudo usermod -aG docker ubuntu
      Then log out and back in for the group change to take effect.

    IMPORTANT: Use docker-compose-plugin (not the legacy docker-compose package).
    The legacy docker-compose v1.29.2 crashes with "KeyError: ContainerConfig" on
    Docker Engine v25+. The plugin ships as `docker compose` (with a space) and
    does not have this bug.

ONE-TIME SETUP:

    Step 1 — From local Git Bash (repo root), copy Adminer to EC2:
        cd /c/Users/Your-Name/Documents/GitHub/FocusLens
        scp -i ~/.ssh/LensPair.pem -r ./Adminer ubuntu@ec2-100-27-212-225.compute-1.amazonaws.com:~/

    Step 2 — SSH into EC2:
        ssh -i ~/.ssh/LensPair.pem ubuntu@ec2-100-27-212-225.compute-1.amazonaws.com

    Step 3 — Start Adminer on EC2:
        cd ~/Adminer
        docker compose -f docker-compose.ec2.yml up --build -d

    Verify it's running:
        docker ps
    You should see an adminer container with port 0.0.0.0:8080->8080.

EVERY TIME YOU WANT TO VIEW THE DB:

    Adminer is always running on EC2, so no need to start it.
    You just need to open an SSH tunnel from your local machine to forward
    EC2's port 8080 to your localhost.

    REQUIREMENT: You need the LensPair.pem key file — do NOT commit it to the repo.

    Step 1 — Place LensPair.pem in your ~/.ssh/ folder (one-time, if you haven't already):
        mkdir -p ~/.ssh
        mv /path/to/LensPair.pem ~/.ssh/LensPair.pem (basically move the .pem file into .ssh folder)
        chmod 400 ~/.ssh/LensPair.pem

    Step 2 — Open SSH tunnel from a local terminal (keep it open, no output is normal):
        ssh -i ~/.ssh/LensPair.pem -L 8080:localhost:8080 ubuntu@ec2-100-27-212-225.compute-1.amazonaws.com -N

    Step 3 — Open browser and go to:
        http://localhost:8080

    Step 4 — Login:
        Username = (empty)
        Password = (empty)
        Database = /db/focuslens.db

IF YOU UPDATE docker-compose.ec2.yml:

    Step 1 — From local Git Bash (repo root), resend the file:
        cd /c/Users/Sebas/Documents/GitHub/FocusLens
        scp -i ~/.ssh/LensPair.pem ./Adminer/docker-compose.ec2.yml ubuntu@ec2-100-27-212-225.compute-1.amazonaws.com:~/Adminer/

    Step 2 — On EC2, restart the container:
        cd ~/Adminer
        docker compose down
        docker compose -f docker-compose.ec2.yml up --build -d

NOTE: EC2 public DNS changes if the instance is stopped and restarted.
      Update the hostname in all commands above when that happens.
